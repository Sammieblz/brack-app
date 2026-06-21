import { expect, test } from "@playwright/test";

test("public app shell loads without a page error", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByText(/page error|something went wrong/i)).toHaveCount(0);
});

test("authenticated library survives an offline reload", async ({ page, context }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "E2E account is not configured");
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.goto("/my-books");
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/my library/i)).toBeVisible();
});
