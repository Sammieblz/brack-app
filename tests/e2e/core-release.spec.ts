import { expect, test } from "@playwright/test";

test("public app shell loads without a page error", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /turn every page into progress/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText(/page error|something went wrong/i)).toHaveCount(0);
  expect(runtimeErrors, "The client should mount without an uncaught runtime error").toEqual([]);
});

test("onboarding stays usable without horizontal clipping on phone and tablet", async ({ page }) => {
  // This test validates layout, not motion. Disabling decorative transitions also
  // prevents a cold CI worker from spending the assertion window on entrance animation.
  await page.emulateMedia({ reducedMotion: "reduce" });

  const viewports = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ];
  const chapterHeadings = [
    /make Brack feel like it already knows your library/i,
    /Pick the palette Brack should remember/i,
    /Choose the genres Brack should learn first/i,
    /Tell Brack how reading fits your real life/i,
    /Set a first target/i,
    /This is the starting profile Brack will use/i,
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding?from=landing", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator(".onboarding-page"),
      "The public onboarding route should finish auth and draft bootstrap before layout assertions",
    ).toBeVisible({ timeout: 15_000 });

    for (const [index, heading] of chapterHeadings.entries()) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();

      const overflow = await page.locator(".onboarding-page").evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      const primaryAction = page.locator(".onboarding-action-dock").getByRole("button", {
        name:
          index === chapterHeadings.length - 1
            ? /^(?:sign up|continue to sign up)$/i
            : /^continue$/i,
      });
      await expect(primaryAction).toBeVisible();
      const actionBox = await primaryAction.boundingBox();
      expect(actionBox).not.toBeNull();
      expect(actionBox!.x).toBeGreaterThanOrEqual(0);
      expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(viewport.width + 1);

      if (index < chapterHeadings.length - 1) {
        await primaryAction.click();
      }
    }
  }
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
