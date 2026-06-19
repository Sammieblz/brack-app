import { _electron as electron, expect, test } from "@playwright/test";

test("desktop shell opens the Brack renderer", async () => {
  const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...env } = process.env;
  const app = await electron.launch({ args: ["."], env });
  const window = await app.firstWindow();
  await expect(window.locator("body")).toBeVisible();
  await expect(window.getByText(/page error|something went wrong/i)).toHaveCount(0);
  await app.close();
});
