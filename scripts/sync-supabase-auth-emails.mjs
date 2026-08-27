import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
export const AUTH_EMAIL_MANIFEST_PATH = path.join(
  REPOSITORY_ROOT,
  "supabase",
  "templates",
  "auth-email-manifest.json",
);
const SUPABASE_CONFIG_PATH = path.join(REPOSITORY_ROOT, "supabase", "config.toml");

const AUTH_TEMPLATE_FIELDS = [
  "mailer_subjects_confirmation",
  "mailer_templates_confirmation_content",
  "mailer_subjects_invite",
  "mailer_templates_invite_content",
  "mailer_subjects_magic_link",
  "mailer_templates_magic_link_content",
  "mailer_subjects_email_change",
  "mailer_templates_email_change_content",
  "mailer_subjects_recovery",
  "mailer_templates_recovery_content",
  "mailer_subjects_reauthentication",
  "mailer_templates_reauthentication_content",
];

const SECURITY_NOTIFICATION_FIELDS = [
  "mailer_notifications_password_changed_enabled",
  "mailer_subjects_password_changed_notification",
  "mailer_templates_password_changed_notification_content",
  "mailer_notifications_email_changed_enabled",
  "mailer_subjects_email_changed_notification",
  "mailer_templates_email_changed_notification_content",
  "mailer_notifications_phone_changed_enabled",
  "mailer_subjects_phone_changed_notification",
  "mailer_templates_phone_changed_notification_content",
  "mailer_notifications_identity_linked_enabled",
  "mailer_subjects_identity_linked_notification",
  "mailer_templates_identity_linked_notification_content",
  "mailer_notifications_identity_unlinked_enabled",
  "mailer_subjects_identity_unlinked_notification",
  "mailer_templates_identity_unlinked_notification_content",
  "mailer_notifications_mfa_factor_enrolled_enabled",
  "mailer_subjects_mfa_factor_enrolled_notification",
  "mailer_templates_mfa_factor_enrolled_notification_content",
  "mailer_notifications_mfa_factor_unenrolled_enabled",
  "mailer_subjects_mfa_factor_unenrolled_notification",
  "mailer_templates_mfa_factor_unenrolled_notification_content",
];

export const MANAGED_AUTH_EMAIL_FIELDS = Object.freeze([
  ...AUTH_TEMPLATE_FIELDS,
  ...SECURITY_NOTIFICATION_FIELDS,
]);
const MANAGED_AUTH_EMAIL_FIELD_SET = new Set(MANAGED_AUTH_EMAIL_FIELDS);

const AUTHENTICATION_TEMPLATE_IDS = new Set([
  "confirmation",
  "invite",
  "magic_link",
  "email_change",
  "recovery",
  "reauthentication",
]);

const SECURITY_NOTIFICATION_IDS = new Set([
  "password_changed",
  "email_changed",
  "phone_changed",
  "identity_linked",
  "identity_unlinked",
  "mfa_factor_enrolled",
  "mfa_factor_unenrolled",
]);

const EXPECTED_TEMPLATE_IDS = new Set([
  ...AUTHENTICATION_TEMPLATE_IDS,
  ...SECURITY_NOTIFICATION_IDS,
]);

const CONFIG_SECTION_BY_ID = Object.freeze({
  confirmation: "auth.email.template.confirmation",
  invite: "auth.email.template.invite",
  magic_link: "auth.email.template.magic_link",
  email_change: "auth.email.template.email_change",
  recovery: "auth.email.template.recovery",
  reauthentication: "auth.email.template.reauthentication",
  password_changed: "auth.email.notification.password_changed",
  email_changed: "auth.email.notification.email_changed",
  phone_changed: "auth.email.notification.phone_changed",
  identity_linked: "auth.email.notification.identity_linked",
  identity_unlinked: "auth.email.notification.identity_unlinked",
  mfa_factor_enrolled: "auth.email.notification.mfa_factor_enrolled",
  mfa_factor_unenrolled: "auth.email.notification.mfa_factor_unenrolled",
});

const REQUIRED_VARIABLES_BY_ID = Object.freeze({
  confirmation: ["ConfirmationURL"],
  invite: ["ConfirmationURL"],
  magic_link: ["ConfirmationURL", "Token"],
  email_change: ["ConfirmationURL", "NewEmail"],
  recovery: ["ConfirmationURL"],
  reauthentication: ["Token"],
  password_changed: ["Email"],
  email_changed: ["OldEmail", "Email"],
  phone_changed: ["OldPhone", "Phone"],
  identity_linked: ["Provider", "Email"],
  identity_unlinked: ["Provider", "Email"],
  mfa_factor_enrolled: ["FactorType", "Email"],
  mfa_factor_unenrolled: ["FactorType", "Email"],
});

const normalizeText = (value) => String(value).replaceAll("\r\n", "\n").trim();

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const assertString = (value, label) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getTomlSection = (config, sectionName) => {
  const headerPattern = new RegExp(
    `^[\\t ]*\\[${escapeRegExp(sectionName)}\\][\\t ]*(?:#.*)?$`,
    "m",
  );
  const headerMatch = headerPattern.exec(config);
  if (!headerMatch) return "";

  const sectionStart = headerMatch.index + headerMatch[0].length;
  const remainingConfig = config.slice(sectionStart);
  const nextSectionOffset = remainingConfig.search(/^\s*\[[^\r\n]+\]\s*(?:#.*)?$/m);
  return nextSectionOffset < 0
    ? remainingConfig
    : remainingConfig.slice(0, nextSectionOffset);
};

export const hasTomlAssignment = (section, key, value) =>
  new RegExp(
    `^[\\t ]*${escapeRegExp(key)}[\\t ]*=[\\t ]*${escapeRegExp(String(value))}[\\t ]*(?:#.*)?$`,
    "m",
  ).test(section);

const getExpectedManagedFields = (entry) => {
  const expectedKind = AUTHENTICATION_TEMPLATE_IDS.has(entry.id)
    ? "authentication"
    : "security_notification";
  const notificationSuffix = expectedKind === "security_notification"
    ? "_notification"
    : "";

  return {
    kind: expectedKind,
    subjectField: `mailer_subjects_${entry.id}${notificationSuffix}`,
    contentField: `mailer_templates_${entry.id}${notificationSuffix}_content`,
    enabledField: expectedKind === "security_notification"
      ? `mailer_notifications_${entry.id}_enabled`
      : null,
  };
};

const assertHtmlTemplate = (entry, html) => {
  const label = `Template ${entry.id}`;
  const normalized = normalizeText(html);

  for (const requiredFragment of [
    "<!doctype html>",
    "<html",
    "<head>",
    "charset=",
    "name=\"viewport\"",
    "<body",
    "role=\"presentation\"",
    "@media",
    "BRACK",
  ]) {
    if (!normalized.toLowerCase().includes(requiredFragment.toLowerCase())) {
      throw new Error(`${label} is missing ${requiredFragment}.`);
    }
  }

  if (/<script\b/i.test(normalized) || /<form\b/i.test(normalized)) {
    throw new Error(`${label} contains an unsafe email element.`);
  }

  for (const variable of REQUIRED_VARIABLES_BY_ID[entry.id] ?? []) {
    if (!normalized.includes(`{{ .${variable} }}`)) {
      throw new Error(`${label} must include {{ .${variable} }}.`);
    }
  }
};

export const loadManagedAuthEmailConfig = async () => {
  const manifest = await readJson(AUTH_EMAIL_MANIFEST_PATH);
  const config = await readFile(SUPABASE_CONFIG_PATH, "utf8");

  if (manifest.schema_version !== 1 || !Array.isArray(manifest.templates)) {
    throw new Error("Unsupported Auth email manifest schema.");
  }
  if (manifest.templates.length !== EXPECTED_TEMPLATE_IDS.size) {
    throw new Error("Auth email manifest must define exactly 13 templates.");
  }

  const ids = new Set();
  const fields = new Set();
  const loadedTemplates = [];

  for (const entry of manifest.templates) {
    assertString(entry.id, "Template id");
    assertString(entry.kind, `Template ${entry.id} kind`);
    assertString(entry.file, `Template ${entry.id} file`);
    assertString(entry.subject, `Template ${entry.id} subject`);
    assertString(entry.subject_field, `Template ${entry.id} subject_field`);
    assertString(entry.content_field, `Template ${entry.id} content_field`);

    if (!EXPECTED_TEMPLATE_IDS.has(entry.id) || ids.has(entry.id)) {
      throw new Error(`Unexpected or duplicate Auth email template id: ${entry.id}.`);
    }
    ids.add(entry.id);

    const expectedFields = getExpectedManagedFields(entry);
    if (
      entry.kind !== expectedFields.kind ||
      entry.subject_field !== expectedFields.subjectField ||
      entry.content_field !== expectedFields.contentField ||
      (expectedFields.enabledField
        ? entry.enabled_field !== expectedFields.enabledField
        : "enabled_field" in entry)
    ) {
      throw new Error(`Template ${entry.id} does not match its fixed Management API field mapping.`);
    }

    const entryFields = [entry.subject_field, entry.content_field];
    if (entry.kind === "security_notification") {
      if (typeof entry.enabled !== "boolean") {
        throw new Error(`Template ${entry.id} must define a boolean enabled value.`);
      }
      assertString(entry.enabled_field, `Template ${entry.id} enabled_field`);
      entryFields.push(entry.enabled_field);
    } else if (entry.kind !== "authentication" || "enabled_field" in entry) {
      throw new Error(`Template ${entry.id} has an invalid kind or enabled field.`);
    }

    for (const field of entryFields) {
      if (!MANAGED_AUTH_EMAIL_FIELD_SET.has(field) || fields.has(field)) {
        throw new Error(`Unexpected or duplicate managed Auth field: ${field}.`);
      }
      fields.add(field);
    }

    const templatePath = path.resolve(path.dirname(AUTH_EMAIL_MANIFEST_PATH), entry.file);
    const templateRoot = `${path.dirname(AUTH_EMAIL_MANIFEST_PATH)}${path.sep}`;
    if (!templatePath.startsWith(templateRoot)) {
      throw new Error(`Template ${entry.id} resolves outside supabase/templates.`);
    }

    const html = await readFile(templatePath, "utf8");
    assertHtmlTemplate(entry, html);

    const sectionName = CONFIG_SECTION_BY_ID[entry.id];
    const section = getTomlSection(config, sectionName);
    if (!section) throw new Error(`supabase/config.toml is missing [${sectionName}].`);
    if (!hasTomlAssignment(section, "subject", JSON.stringify(entry.subject))) {
      throw new Error(`[${sectionName}] subject does not match the manifest.`);
    }
    // Supabase CLI currently resolves authentication template paths from the
    // repository root and security-notification paths from supabase/config.toml.
    const expectedPath = entry.kind === "authentication"
      ? `./supabase/templates/${entry.file}`
      : `./templates/${entry.file}`;
    if (!hasTomlAssignment(section, "content_path", JSON.stringify(expectedPath))) {
      throw new Error(`[${sectionName}] content_path does not match the manifest.`);
    }
    if (
      entry.kind === "security_notification" &&
      !hasTomlAssignment(section, "enabled", entry.enabled)
    ) {
      throw new Error(`[${sectionName}] enabled does not match the manifest.`);
    }

    loadedTemplates.push({ ...entry, html: normalizeText(html) });
  }

  if (fields.size !== MANAGED_AUTH_EMAIL_FIELDS.length) {
    throw new Error("Auth email manifest does not cover the complete field allowlist.");
  }

  return { manifest, templates: loadedTemplates };
};

export const buildManagedAuthEmailPayload = (loadedConfig) => {
  const payload = {};
  for (const entry of loadedConfig.templates) {
    payload[entry.subject_field] = entry.subject;
    payload[entry.content_field] = entry.html;
    if (entry.kind === "security_notification") {
      payload[entry.enabled_field] = entry.enabled;
    }
  }

  const payloadFields = Object.keys(payload).sort();
  const allowedFields = [...MANAGED_AUTH_EMAIL_FIELDS].sort();
  if (JSON.stringify(payloadFields) !== JSON.stringify(allowedFields)) {
    throw new Error("Refusing to build a payload outside the Auth email allowlist.");
  }
  return payload;
};

export const findManagedAuthEmailDrift = (remoteConfig, payload) =>
  MANAGED_AUTH_EMAIL_FIELDS.filter((field) => {
    const expected = payload[field];
    const actual = remoteConfig?.[field];
    return typeof expected === "string"
      ? normalizeText(actual ?? "") !== normalizeText(expected)
      : actual !== expected;
  });

export const parseArguments = (args) => {
  let mode = null;
  let projectRef = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (["--validate", "--check", "--apply"].includes(argument)) {
      if (mode) {
        throw new Error("Choose exactly one mode: --validate, --check, or --apply.");
      }
      mode = argument.slice(2);
      continue;
    }

    if (argument === "--project-ref") {
      if (projectRef !== null) throw new Error("--project-ref may be supplied only once.");
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--project-ref requires a value.");
      }
      projectRef = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}.`);
  }

  if (!mode) {
    throw new Error("Choose exactly one mode: --validate, --check, or --apply.");
  }
  if (mode === "validate" && projectRef !== null) {
    throw new Error("--project-ref is not used with --validate.");
  }
  if (mode !== "validate" && !/^[a-z0-9]{10,40}$/.test(projectRef ?? "")) {
    throw new Error("--project-ref is required for hosted check/apply operations.");
  }

  return { mode, projectRef };
};

const requestHostedAuthConfig = async ({ projectRef, accessToken, method, payload }) => {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/config/auth`,
    {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase Auth configuration request failed with HTTP ${response.status}.`);
  }
  return response.json();
};

const main = async () => {
  const { mode, projectRef } = parseArguments(process.argv.slice(2));
  const loadedConfig = await loadManagedAuthEmailConfig();
  const payload = buildManagedAuthEmailPayload(loadedConfig);

  if (mode === "validate") {
    console.log(
      `Validated ${loadedConfig.templates.length} Auth email templates and ${Object.keys(payload).length} allowlisted fields.`,
    );
    return;
  }

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required for hosted check/apply operations.");
  }

  const remoteConfig = await requestHostedAuthConfig({
    projectRef,
    accessToken,
    method: "GET",
  });
  const initialDrift = findManagedAuthEmailDrift(remoteConfig, payload);

  if (mode === "check") {
    if (initialDrift.length) {
      throw new Error(`Hosted Auth email drift: ${initialDrift.join(", ")}.`);
    }
    console.log("Hosted Auth email configuration matches source control.");
    return;
  }

  if (!initialDrift.length) {
    console.log("Hosted Auth email configuration already matches source control.");
    return;
  }

  await requestHostedAuthConfig({
    projectRef,
    accessToken,
    method: "PATCH",
    payload,
  });
  const verifiedConfig = await requestHostedAuthConfig({
    projectRef,
    accessToken,
    method: "GET",
  });
  const remainingDrift = findManagedAuthEmailDrift(verifiedConfig, payload);
  if (remainingDrift.length) {
    throw new Error(`Auth email synchronization verification failed: ${remainingDrift.join(", ")}.`);
  }
  console.log(`Synchronized and verified ${initialDrift.length} Auth email fields.`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Auth email workflow failed.");
    process.exitCode = 1;
  });
}
