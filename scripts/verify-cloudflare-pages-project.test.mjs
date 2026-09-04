import assert from "node:assert/strict";
import test from "node:test";

import { verifyCloudflarePagesProject } from "./verify-cloudflare-pages-project.mjs";

const expected = {
  project: "brack-app-staging",
  branch: "test",
  repository: "Sammieblz/brack-app",
};

const gitProject = (overrides = {}) => ({
  success: true,
  result: {
    name: "brack-app-staging",
    production_branch: "test",
    source: {
      type: "github",
      config: {
        owner: "Sammieblz",
        repo_name: "brack-app",
        production_branch: "test",
        production_deployments_enabled: false,
        preview_deployment_setting: "none",
        ...overrides,
      },
    },
  },
});

test("accepts the staging Git project when Cloudflare automatic deployments are disabled", () => {
  const result = verifyCloudflarePagesProject(gitProject(), expected);

  assert.equal(result.mode, "git-integrated");
  assert.deepEqual(result.errors, []);
});

test("accepts a Direct Upload project on the expected production branch", () => {
  const result = verifyCloudflarePagesProject(
    {
      success: true,
      result: {
        name: "brack-app-staging",
        production_branch: "test",
        source: null,
      },
    },
    expected
  );

  assert.equal(result.mode, "direct-upload");
  assert.deepEqual(result.errors, []);
});

test("rejects competing Cloudflare production and preview deployments", () => {
  const result = verifyCloudflarePagesProject(
    gitProject({
      production_deployments_enabled: true,
      preview_deployment_setting: "all",
    }),
    expected
  );

  assert.equal(result.errors.length, 2);
  assert.match(
    result.errors[0],
    /automatic production deployments must be disabled/i
  );
  assert.match(result.errors[1], /Preview branch control must be "None"/i);
});

test("rejects missing connected-repository production branch metadata", () => {
  const result = verifyCloudflarePagesProject(
    gitProject({ production_branch: undefined }),
    expected
  );

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /connected repository production branch/i);
});

test("rejects a different project branch or connected repository", () => {
  const payload = gitProject({
    owner: "someone-else",
    repo_name: "another-repo",
  });
  payload.result.production_branch = "main";

  const result = verifyCloudflarePagesProject(payload, expected);

  assert.equal(result.errors.length, 3);
  assert.match(result.errors.join("\n"), /production branch must be test/i);
  assert.match(result.errors.join("\n"), /GitHub owner Sammieblz/i);
  assert.match(result.errors.join("\n"), /GitHub repository brack-app/i);
});

test("rejects an unsuccessful or malformed Cloudflare response", () => {
  assert.match(
    verifyCloudflarePagesProject({ success: false }, expected).errors[0],
    /successful Pages project response/i
  );
  assert.match(
    verifyCloudflarePagesProject({ success: true }, expected).errors[0],
    /does not contain a Pages project/i
  );
});
