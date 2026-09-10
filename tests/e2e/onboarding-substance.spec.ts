import { expect, test, type Page } from "@playwright/test";

import { getTheme } from "../../apps/client/src/lib/themes";

const forwardLabels = [
  "Make Brack yours",
  "Choose reading taste",
  "Find your rhythm",
  "Set your first goal",
  "Review your plan",
] as const;

async function guardGuestWrites(page: Page) {
  const attemptedWrites: string[] = [];
  await page.route("**/*", (route) => {
    const request = route.request();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      attemptedWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
      return route.abort();
    }
    return route.continue();
  });
  return attemptedWrites;
}

async function expectChapter(page: Page, chapter: number) {
  await expect(page.getByRole("progressbar", { name: "Onboarding setup progress" }))
    .toHaveAttribute("aria-valuenow", String(chapter));
  await expect(page.locator(".onboarding-page h1")).toBeVisible();
}

async function nextChapter(page: Page, from: number) {
  await page.locator(".onboarding-action-dock").getByRole("button", {
    name: forwardLabels[from - 1], exact: true,
  }).click();
  await expectChapter(page, from + 1);
}

const readPrimary = (page: Page) => page.locator("html").evaluate((element) =>
  getComputedStyle(element).getPropertyValue("--primary").trim());

async function expectNoPersistentGuestProfile(page: Page) {
  expect(await page.evaluate(() => ({
    colorTheme: localStorage.getItem("color_theme"),
    localDrafts: Object.keys(localStorage).filter((key) => /onboarding/i.test(key)),
    sessionDrafts: Object.keys(sessionStorage).filter((key) => /onboarding/i.test(key)),
  }))).toEqual({ colorTheme: null, localDrafts: [], sessionDrafts: [] });
}

test("optional reading practice gives real local feedback without creating reading records", async ({ page }) => {
  const attemptedWrites = await guardGuestWrites(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding?from=landing", { waitUntil: "domcontentloaded" });
  await expectChapter(page, 1);

  const practice = page.getByRole("region", { name: "A few pages. A place to return to." });
  const progress = practice.getByRole("progressbar", { name: "Sample book reading progress" });
  await expect(practice.getByText("Optional practice", { exact: true })).toBeVisible();
  await expect(practice).toContainText("Nothing here is added to your library or streak.");
  await expect(progress).toHaveAttribute("aria-valuenow", "32");
  await expect(progress).toHaveAttribute("aria-valuemax", "200");

  const pageInput = practice.getByRole("spinbutton", { name: "Page you reached" });
  await pageInput.fill("201");
  await practice.getByRole("button", { name: "Log practice pages" }).click();
  await expect(pageInput).toBeFocused();
  await expect(practice.getByRole("alert")).toContainText("Choose a page up to 200");
  await expect(progress).toHaveAttribute("aria-valuenow", "32");

  await pageInput.fill("44");
  await pageInput.press("Enter");
  await expect(progress).toHaveAttribute("aria-valuenow", "44");
  await expect(practice.getByRole("status")).toContainText("12 pages read.");
  await expect(practice.getByRole("status")).toContainText("pick up at page 44");
  await expect(practice).toHaveAttribute("data-pointer-motion", "false");
  // The app-wide reduced-motion rule uses 0.01ms to retain transition events.
  expect(await practice.locator(".brack-progress__indicator--default").evaluate((element) =>
    parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(0.001);
  await expect(practice.getByRole("button", { name: "Log practice pages" })).toBeDisabled();

  await practice.getByRole("button", { name: "Reset practice" }).click();
  await expect(progress).toHaveAttribute("aria-valuenow", "32");
  await expect(pageInput).toBeFocused();
  await expect(practice.getByRole("status")).toBeEmpty();
  await expectNoPersistentGuestProfile(page);

  // Trying the sample is not a condition of completing the Welcome chapter.
  await nextChapter(page, 1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectChapter(page, 1);
  await expect(progress).toHaveAttribute("aria-valuenow", "32");
  expect(attemptedWrites).toEqual([]);
});

for (const mode of ["light", "dark"] as const) {
  test(`the ${mode} reading plan responds to choices and remains editable before signup`, async ({ page }) => {
    const attemptedWrites = await guardGuestWrites(page);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    if (mode === "dark") {
      await page.getByRole("button", { name: "Switch to dark mode" }).click();
    }
    await page.getByRole("link", { name: "Begin with your shelf" }).click();
    await expectChapter(page, 1);
    await nextChapter(page, 1);

    const palette = page.getByRole("button", { name: /Purple Sage/ });
    await palette.focus();
    await page.keyboard.press("Enter");
    await expect(palette).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[aria-label="Palette preview"]')).toBeVisible();
    await expect.poll(() => readPrimary(page)).toBe(getTheme("purple-sage").colors[mode].primary);
    await nextChapter(page, 2);

    // The required taste question explains its validation on the current page.
    await page.locator(".onboarding-action-dock").getByRole("button", { name: "Find your rhythm" }).click();
    await expectChapter(page, 3);
    await expect(page.getByRole("group", { name: "Favorite genres" }).getByRole("button").first()).toBeFocused();
    await page.getByRole("button", { name: "Fantasy", exact: true }).click();
    const taste = page.locator('[aria-label="Your reading taste"]');
    await expect(taste).toBeVisible();
    await expect(taste).toContainText("Fantasy");
    await nextChapter(page, 3);

    const history = page.getByText("Add more detail (optional)", { exact: true });
    await expect(history).toBeVisible();
    await expect(page.getByLabel("Books in 6 months", { exact: true })).not.toBeVisible();
    await history.click();
    await page.getByLabel("Books in 6 months", { exact: true }).fill("4");
    await history.click();
    await expect(page.getByLabel("Books in 6 months", { exact: true })).not.toBeVisible();

    await page.getByRole("spinbutton", { name: "Minutes per reading session" }).fill("4");
    await page.locator(".onboarding-action-dock").getByRole("button", { name: "Set your first goal", exact: true }).click();
    await expectChapter(page, 4);
    await expect(page.getByRole("alert")).toContainText("5 to 300 minutes");
    await expect(page.getByRole("spinbutton", { name: "Minutes per reading session" })).toBeFocused();
    await page.getByRole("button", { name: "30 minutes", exact: true }).click();
    await page.getByRole("button", { name: "Evening", exact: true }).click();
    await page.getByRole("button", { name: "A few times weekly", exact: true }).click();
    await page.getByRole("button", { name: "Print", exact: true }).click();
    const rhythm = page.locator('[aria-label="Your reading rhythm"]');
    await expect(rhythm).toBeVisible();
    await expect(rhythm).toContainText("30 minutes in the evening, a few times a week.");
    await nextChapter(page, 4);

    await page.getByRole("spinbutton", { name: "Target books", exact: true }).fill("8");
    const goal = page.locator('[aria-label="Your goal at a glance"]');
    await expect(goal).toBeVisible();
    await expect(goal).toContainText("8 books");
    await nextChapter(page, 5);

    const review = page.locator(".onboarding-page");
    await expect(review).toContainText("30 minutes in the evening, a few times a week.");
    await expect(review).toContainText("Print books");
    await expect(review).not.toContainText("few_weekly");
    await expect(review).not.toContainText("Learning signals");
    await page.getByRole("button", { name: "Edit pace", exact: true }).click();
    await expectChapter(page, 4);
    await history.click();
    await expect(page.getByLabel("Books in 6 months", { exact: true })).toHaveValue("4");
    await history.click();
    await page.getByRole("spinbutton", { name: "Minutes per reading session" }).fill("25");
    await page.locator(".onboarding-action-dock").getByRole("button", { name: "Back to review", exact: true }).click();
    await expectChapter(page, 6);
    await expect(review).toContainText("25 minutes in the evening, a few times a week.");

    await expectNoPersistentGuestProfile(page);
    await page.locator(".onboarding-action-dock").getByRole("button", {
      name: /^(?:sign up|continue to sign up)$/i,
    }).click();
    await expect(page).toHaveURL(/\/auth\?.*mode=signup/);
    await expect.poll(() => readPrimary(page)).toBe(getTheme("purple-sage").colors[mode].primary);
    await expectNoPersistentGuestProfile(page);

    // Stop before creating an account. Reload intentionally discards the guest
    // answers/palette instead of silently retaining personal questionnaire data.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => readPrimary(page)).toBe(getTheme("default").colors[mode].primary);
    await expectNoPersistentGuestProfile(page);
    expect(attemptedWrites).toEqual([]);
  });
}

test("every chapter keeps usable controls at compact widths and 200 percent text", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The explicit layout matrix includes phone viewports.");
  test.setTimeout(90_000);
  await guardGuestWrites(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding?from=landing", { waitUntil: "domcontentloaded" });
    await expectChapter(page, 1);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });

    for (let chapter = 1; chapter <= 6; chapter += 1) {
      await expectChapter(page, chapter);
      for (const selector of [".onboarding-page", ".onboarding-action-dock"]) {
        const dimensions = await page.locator(selector).evaluate((element) => ({
          client: element.clientWidth, scroll: element.scrollWidth,
        }));
        expect(dimensions.scroll, `${selector}, chapter ${chapter}, ${viewport.width}px`)
          .toBeLessThanOrEqual(dimensions.client + 1);
      }
      if (chapter === 3) {
        await page.getByRole("button", { name: "Fantasy", exact: true }).click();
      }
      if (chapter < 6) await nextChapter(page, chapter);
    }
    const finish = page.locator(".onboarding-action-dock").getByRole("button", {
      name: /^(?:sign up|continue to sign up)$/i,
    });
    await expect(finish).toBeVisible();
    const box = await finish.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  }
});
