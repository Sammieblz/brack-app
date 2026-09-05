#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const REQUIRED_OPTIONS = ["input", "project", "branch", "repository"];

const parseArguments = (args) => {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const name = argument.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }

    options[name] = value;
    index += 1;
  }

  const missing = REQUIRED_OPTIONS.filter((option) => !options[option]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required option(s): ${missing
        .map((name) => `--${name}`)
        .join(", ")}`
    );
  }

  return options;
};

const normalized = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizedStatus = (value) => {
  const status = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : null;
};

const safeApiText = (value) =>
  String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bcfat_[0-9A-Za-z_-]+\b/g, "[redacted]")
    .trim()
    .slice(0, 240);

export const describeCloudflareApiFailure = (
  payload,
  { operation, httpStatus } = {}
) => {
  const status = normalizedStatus(httpStatus);
  const statusSuffix = status ? ` (HTTP ${status})` : "";
  const apiErrors = Array.isArray(payload?.errors)
    ? payload.errors
        .map((error) => {
          if (!error || typeof error !== "object") return "";
          const code = safeApiText(error.code);
          const message = safeApiText(error.message);
          if (!code && !message) return "";
          if (code && message) return `Cloudflare code ${code}: ${message}`;
          return message || `Cloudflare code ${code}`;
        })
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const details = apiErrors.length > 0 ? ` ${apiErrors.join("; ")}.` : "";

  return `Cloudflare ${operation || "API request"} failed${statusSuffix}.${details}`;
};

export const verifyCloudflareToken = (payload, { httpStatus } = {}) => {
  const errors = [];

  if (!payload || typeof payload !== "object" || payload.success !== true) {
    errors.push(
      describeCloudflareApiFailure(payload, {
        operation: "token verification",
        httpStatus,
      })
    );
    errors.push(
      "Replace the GitHub stage environment secret with an active Cloudflare token for the account that owns brack-app-staging; do not restrict it to GitHub runner IPs."
    );
    return { errors };
  }

  const tokenStatus = normalized(payload.result?.status);
  if (tokenStatus !== "active") {
    errors.push(
      `The Cloudflare API token is ${tokenStatus || "missing a status"}; an active token is required.`
    );
  }

  return { errors };
};

export const verifyCloudflarePagesProject = (
  payload,
  { project, branch, repository, httpStatus }
) => {
  const errors = [];

  if (!payload || typeof payload !== "object" || payload.success !== true) {
    errors.push(
      describeCloudflareApiFailure(payload, {
        operation: "Pages project request",
        httpStatus,
      })
    );
    if ([401, 403].includes(normalizedStatus(httpStatus))) {
      errors.push(
        "Grant the token Account > Cloudflare Pages > Edit for the exact account that owns brack-app-staging. A GitHub environment does not grant Cloudflare access."
      );
    }
    return { errors, mode: "unknown" };
  }

  const result = payload.result;
  if (!result || typeof result !== "object") {
    return {
      errors: ["Cloudflare's response does not contain a Pages project."],
      mode: "unknown",
    };
  }

  if (result.name !== project) {
    errors.push(
      `Expected Pages project ${project}, received ${
        result.name || "an unnamed project"
      }.`
    );
  }

  if (result.production_branch !== branch) {
    errors.push(
      `Pages production branch must be ${branch}; received ${
        result.production_branch || "no value"
      }.`
    );
  }

  const source = result.source;
  if (!source) {
    return { errors, mode: "direct-upload" };
  }

  if (source.type !== "github") {
    errors.push(
      `Pages source must be GitHub when a source is connected; received ${
        source.type || "no value"
      }.`
    );
  }

  const config = source.config;
  if (!config || typeof config !== "object") {
    errors.push(
      "The Git-connected Pages project is missing its source configuration."
    );
    return { errors, mode: "git-integrated" };
  }

  const [expectedOwner, expectedRepository] = repository.split("/");
  if (
    !expectedOwner ||
    !expectedRepository ||
    repository.split("/").length !== 2
  ) {
    errors.push(
      `Expected repository must use owner/name format; received ${repository}.`
    );
  } else {
    if (normalized(config.owner) !== normalized(expectedOwner)) {
      errors.push(`Pages must be connected to GitHub owner ${expectedOwner}.`);
    }
    if (normalized(config.repo_name) !== normalized(expectedRepository)) {
      errors.push(
        `Pages must be connected to GitHub repository ${expectedRepository}.`
      );
    }
  }

  if (config.production_branch !== branch) {
    errors.push(
      `The connected repository production branch must be ${branch}.`
    );
  }

  if (config.production_deployments_enabled !== false) {
    errors.push(
      "Cloudflare automatic production deployments must be disabled; GitHub Actions owns staging releases."
    );
  }

  if (config.preview_deployment_setting !== "none") {
    errors.push(
      'Cloudflare Preview branch control must be "None"; GitHub Actions owns staging releases.'
    );
  }

  return { errors, mode: "git-integrated" };
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options["token-input"]) {
    const rawTokenPayload = await readFile(options["token-input"], "utf8");
    const tokenPayload = JSON.parse(rawTokenPayload);
    const tokenResult = verifyCloudflareToken(tokenPayload, {
      httpStatus: options["token-http-status"],
    });

    if (tokenResult.errors.length > 0) {
      console.error("Cloudflare staging-token verification failed:");
      for (const error of tokenResult.errors) {
        console.error(`- ${error}`);
      }
      process.exitCode = 1;
      return;
    }
  }

  const rawPayload = await readFile(options.input, "utf8");
  const payload = JSON.parse(rawPayload);
  const result = verifyCloudflarePagesProject(payload, {
    ...options,
    httpStatus: options["http-status"],
  });

  if (result.errors.length > 0) {
    console.error("Cloudflare Pages staging-boundary verification failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  const sourceDescription =
    result.mode === "git-integrated"
      ? "Git-triggered production and preview deployments are disabled"
      : "the project is configured for Direct Upload";
  console.log(
    `Verified ${options.project}: ${options.branch} is the production branch and ${sourceDescription}.`
  );
};

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(
      `Cloudflare Pages staging-boundary verification failed: ${error.message}`
    );
    process.exitCode = 1;
  });
}
