import { expect, test, type Locator } from "@playwright/test";
import { getTheme } from "../../apps/client/src/lib/themes";

const readLogo = (logo: Locator) => logo.evaluate((element) => {
  const style = getComputedStyle(element);
  return {
    fill: style.backgroundImage,
    mask: style.maskImage,
    ratio: style.aspectRatio,
    primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
  };
});

for (const mode of ["light", "dark"] as const) {
  test(`the ${mode} onboarding palette follows the shared logo into signup`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    // This regression stops at the signup screen. Never write to a remote
    // service or submit a signup if an unrelated background request appears.
    await page.route("**/*", (route) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const landingLogo = page.locator("header .brack-logo");
    await expect(landingLogo).toBeVisible({ timeout: 15_000 });
    if (mode === "dark") {
      await page.getByRole("button", { name: "Switch to dark mode" }).click();
    }
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${mode}\\b`));
    const originalLogo = await readLogo(landingLogo);
    expect(originalLogo.mask).toContain("/brack-wordmark.webp");
    expect(originalLogo.ratio).toBe("4 / 1");
    expect(originalLogo.fill).not.toBe("none");

    await page.getByRole("link", { name: "Begin with your shelf" }).click();
    const onboardingLogo = page.locator(".onboarding-logo .brack-logo");
    await expect(onboardingLogo).toBeVisible({ timeout: 15_000 });
    const next = page.locator(".onboarding-action-dock").getByRole("button", { name: "Continue", exact: true });
    await next.click();
    await expect(page.getByRole("heading", { name: "Pick the palette Brack should remember", level: 1 })).toBeVisible();

    // Keyboard focus can reach the next carousel card at phone and desktop widths.
    const purplePalette = page.getByRole("button", { name: /Purple Sage/ });
    await purplePalette.focus();
    await page.keyboard.press("Enter");
    await expect(purplePalette).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await readLogo(onboardingLogo)).primary)
      .toBe(getTheme("purple-sage").colors[mode].primary);
    const selectedLogo = await readLogo(onboardingLogo);
    expect(selectedLogo.fill).not.toBe(originalLogo.fill);
    expect(selectedLogo.mask).toBe(originalLogo.mask);

    for (const [index, heading] of [
      /Choose the genres Brack should learn first/i,
      /Tell Brack how reading fits your real life/i,
      /Set a first target/i,
      /This is the starting profile Brack will use/i,
    ].entries()) {
      await next.click();
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      if (index === 0) {
        await page.getByRole("button", { name: "Fantasy", exact: true }).click();
      }
    }
    await page.locator(".onboarding-action-dock").getByRole("button", {
      name: /^(?:sign up|continue to sign up)$/i,
    }).click();
    await expect(page).toHaveURL(/\/auth\?.*mode=signup/);
    const signupLogo = page.locator(".brack-logo");
    await expect(signupLogo).toBeVisible();
    await expect.poll(async () => readLogo(signupLogo)).toEqual(selectedLogo);
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${mode}\\b`));

    const otherMode = mode === "light" ? "dark" : "light";
    await page.getByRole("button", { name: `Switch to ${otherMode} mode` }).click();
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${otherMode}\\b`));
    // Allow a painted frame after the mode change, so a stale delayed callback
    // cannot briefly show the chosen palette and then replace it with orange.
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await expect.poll(async () => (await readLogo(signupLogo)).primary)
      .toBe(getTheme("purple-sage").colors[otherMode].primary);
    const switchedLogo = await readLogo(signupLogo);
    expect(switchedLogo.fill).not.toBe(selectedLogo.fill);
    expect(switchedLogo.mask).toBe(selectedLogo.mask);

    await page.getByRole("button", { name: `Switch to ${mode} mode` }).click();
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${mode}\\b`));
    await expect.poll(async () => readLogo(signupLogo)).toEqual(selectedLogo);
    expect(await page.evaluate(() => localStorage.getItem("color_theme"))).toBeNull();
  });
}
