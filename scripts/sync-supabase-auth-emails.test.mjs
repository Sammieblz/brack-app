import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AUTH_EMAIL_MANIFEST_PATH,
  MANAGED_AUTH_EMAIL_FIELDS,
  buildManagedAuthEmailPayload,
  findManagedAuthEmailDrift,
  getTomlSection,
  hasTomlAssignment,
  loadManagedAuthEmailConfig,
  parseArguments,
} from "./sync-supabase-auth-emails.mjs";

test("manifest covers only the 33 approved Auth email fields", async () => {
  const loaded = await loadManagedAuthEmailConfig();
  const payload = buildManagedAuthEmailPayload(loaded);

  assert.equal(loaded.templates.length, 13);
  assert.equal(Object.keys(payload).length, 33);
  assert.deepEqual(Object.keys(payload).sort(), [...MANAGED_AUTH_EMAIL_FIELDS].sort());
  assert.equal(
    Object.keys(payload).some((field) =>
      /(smtp|secret|captcha|oauth|site_url|uri_allow_list|password)/i.test(
        field.replace("password_changed", ""),
      ),
    ),
    false,
  );
});

test("same-context email flows expose OTPs and email change identifies the destination", async () => {
  const loaded = await loadManagedAuthEmailConfig();
  const confirmation = loaded.templates.find((template) => template.id === "confirmation");
  const recovery = loaded.templates.find((template) => template.id === "recovery");
  const magicLink = loaded.templates.find((template) => template.id === "magic_link");
  const emailChange = loaded.templates.find((template) => template.id === "email_change");

  assert.match(confirmation.html, /{{ \.Token }}/);
  assert.match(recovery.html, /{{ \.Token }}/);
  assert.match(magicLink.html, /{{ \.ConfirmationURL }}/);
  assert.match(magicLink.html, /{{ \.Token }}/);
  assert.match(emailChange.html, /{{ \.NewEmail }}/);
});

test("authentication email links request a separate browser context as fallback", async () => {
  const loaded = await loadManagedAuthEmailConfig();

  for (const template of loaded.templates.filter(
    (candidate) =>
      candidate.kind === "authentication" &&
      candidate.html.includes("{{ .ConfirmationURL }}"),
  )) {
    const confirmationLinks = template.html.match(
      /<a\b[^>]*href="{{ \.ConfirmationURL }}"[^>]*>/g,
    );
    assert.ok(confirmationLinks?.length, template.id);
    for (const link of confirmationLinks) {
      assert.match(link, /target="_blank"/, template.id);
      assert.match(link, /rel="noopener noreferrer"/, template.id);
    }
  }
});

test("each template is pinned to its exact Management API fields", async () => {
  const loaded = await loadManagedAuthEmailConfig();
  const payload = buildManagedAuthEmailPayload(loaded);
  const byId = Object.fromEntries(
    loaded.templates.map((template) => [template.id, template]),
  );

  assert.equal(
    payload.mailer_templates_confirmation_content,
    byId.confirmation.html,
  );
  assert.equal(
    payload.mailer_templates_recovery_content,
    byId.recovery.html,
  );
  assert.equal(
    payload.mailer_templates_identity_linked_notification_content,
    byId.identity_linked.html,
  );
  assert.equal(
    payload.mailer_notifications_mfa_factor_unenrolled_enabled,
    byId.mfa_factor_unenrolled.enabled,
  );
});

test("all templates are complete responsive documents without active content", async () => {
  const loaded = await loadManagedAuthEmailConfig();

  for (const template of loaded.templates) {
    assert.match(template.html, /<!doctype html>/i, template.id);
    assert.match(template.html, /<meta[^>]+name="viewport"/i, template.id);
    assert.match(template.html, /role="presentation"/i, template.id);
    assert.match(template.html, /@media/i, template.id);
    assert.doesNotMatch(template.html, /<(script|form)\b/i, template.id);
  }
});

test("drift comparison normalizes line endings but preserves subjects and flags", async () => {
  const loaded = await loadManagedAuthEmailConfig();
  const payload = buildManagedAuthEmailPayload(loaded);
  const remote = Object.fromEntries(
    Object.entries(payload).map(([field, value]) => [
      field,
      typeof value === "string" ? value.replaceAll("\n", "\r\n") : value,
    ]),
  );

  assert.deepEqual(findManagedAuthEmailDrift(remote, payload), []);
  remote.mailer_subjects_confirmation = "Changed subject";
  remote.mailer_notifications_password_changed_enabled = false;
  assert.deepEqual(findManagedAuthEmailDrift(remote, payload), [
    "mailer_subjects_confirmation",
    "mailer_notifications_password_changed_enabled",
  ]);
});

test("manifest itself contains no credential-bearing values", async () => {
  const source = await readFile(AUTH_EMAIL_MANIFEST_PATH, "utf8");
  assert.doesNotMatch(source, /smtp_pass|security_captcha_secret|external_.*_secret/i);
});

test("TOML validation ignores commented sections and assignments", () => {
  const source = [
    "# [auth.email.template.confirmation]",
    "# subject = \"Wrong\"",
    "[auth.email.template.invite]",
    "# subject = \"You have been invited\"",
    "content_path = \"./supabase/templates/invite.html\"",
  ].join("\n");

  assert.equal(getTomlSection(source, "auth.email.template.confirmation"), "");
  const invite = getTomlSection(source, "auth.email.template.invite");
  assert.equal(
    hasTomlAssignment(invite, "subject", '"You have been invited"'),
    false,
  );
  assert.equal(
    hasTomlAssignment(
      invite,
      "content_path",
      '"./supabase/templates/invite.html"',
    ),
    true,
  );
});

test("CLI parsing rejects ambiguous or irrelevant hosted arguments", () => {
  assert.deepEqual(parseArguments(["--validate"]), {
    mode: "validate",
    projectRef: null,
  });
  assert.deepEqual(
    parseArguments(["--check", "--project-ref", "waftnaqgkcgufzapcihe"]),
    { mode: "check", projectRef: "waftnaqgkcgufzapcihe" },
  );
  assert.throws(
    () => parseArguments(["--validate", "--project-ref", "waftnaqgkcgufzapcihe"]),
    /not used with --validate/,
  );
  assert.throws(
    () => parseArguments([
      "--apply",
      "--project-ref",
      "waftnaqgkcgufzapcihe",
      "--project-ref",
      "waftnaqgkcgufzapcihe",
    ]),
    /only once/,
  );
  assert.throws(
    () => parseArguments(["--check", "--project-ref"]),
    /requires a value/,
  );
});
