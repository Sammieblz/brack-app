import { expect, test } from "@playwright/test";

test("public landing shell is responsive and theme-aware", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /a reading life deserves a record/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".landing-typewriter")).toHaveAttribute("data-typing", "false");
  const headlineSizes = await page.locator("h1").evaluate((heading) => ({
    heading: getComputedStyle(heading).fontSize,
    letter: getComputedStyle(heading.querySelector(".landing-typewriter__character")!).fontSize,
  }));
  expect(headlineSizes.letter, "Animated letters must inherit headline typography").toBe(headlineSizes.heading);
  await expect(page.locator(".landing-hero__photograph img")).toHaveJSProperty("complete", true);
  expect(
    await page.locator(".landing-hero__photograph img").evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);

  const landingCtas = [
    page.getByRole("link", { name: "Begin with your shelf" }),
    page.getByRole("link", { name: "Sign in to my account" }),
    page.getByRole("link", { name: "Start the reading profile" }),
  ];
  for (const cta of landingCtas) {
    await expect(cta).toHaveAttribute("href", /^(?:\/onboarding\?from=landing|\/auth\?mode=signin)$/);
    await expect(cta.locator("svg"), "Landing calls to action should use weight, not decorative arrows").toHaveCount(0);
  }
  await expect(page.locator('a[href="/onboarding?from=landing"] svg')).toHaveCount(0);

  const lightLibraryPreview = page.getByRole("img", {
    name: /Brack Library showing reading progress in light mode/i,
  });
  await lightLibraryPreview.scrollIntoViewIfNeeded();
  await expect(lightLibraryPreview).toBeVisible();

  const appStore = page.getByRole("button", { name: "Coming soon on App Store" });
  const googlePlay = page.getByRole("button", { name: "Coming soon on Google Play" });
  await appStore.click();
  await expect(page.locator(".landing-store-badges__status")).toContainText("iPhone and iPad is coming soon");
  await googlePlay.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".landing-store-badges__status")).toContainText("Android is coming soon");
  expect(new URL(page.url()).pathname).toBe("/");

  const overflow = await page.locator("#root").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  await page.getByRole("button", { name: /switch to dark mode/i }).click();
  await expect(page.locator(".landing-typewriter")).toHaveAttribute("data-typing", "false");
  await expect(
    page.getByRole("img", {
      name: /Brack Library showing reading progress in dark mode/i,
    }),
  ).toHaveAttribute("src", "/landing-page/landing-page-pic-dark.png");

  const flameToggle = page.getByRole("button", {
    name: "Preview missed-day streak state",
  });
  await flameToggle.scrollIntoViewIfNeeded();
  await expect(flameToggle).toHaveAttribute("aria-pressed", "false");
  await flameToggle.click();
  await expect(flameToggle).toHaveAttribute("aria-pressed", "true");
  await expect(flameToggle.locator("img")).toHaveAttribute("src", "/brack-streak/brack-streak-image-sad.webp");
  await flameToggle.click();
  await expect(flameToggle).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Animate Lifetime Ink" }).click();
  await page.getByRole("button", { name: "Animate Gold Leaves" }).click();

  const postInteractionOverflow = await page.locator("#root").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(postInteractionOverflow.scrollWidth).toBeLessThanOrEqual(postInteractionOverflow.clientWidth + 1);

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const resizedOverflow = await page.locator("#root").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(resizedOverflow.scrollWidth).toBeLessThanOrEqual(resizedOverflow.clientWidth + 1);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  const readingStepArt = page.locator(".landing-reading-step-art");
  await expect(readingStepArt).toHaveCount(3);
  for (const artwork of await readingStepArt.all()) {
    await artwork.scrollIntoViewIfNeeded();
    await expect(artwork).toHaveAttribute("aria-hidden", "true");
    const image = artwork.locator("img");
    await expect(image).toHaveJSProperty("complete", true);
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveCSS("transform", "none");
  }
  for (const illustration of await page.locator(".landing-illustration").all()) {
    await illustration.scrollIntoViewIfNeeded();
    await expect(illustration).toHaveAttribute("data-reduced-motion", "true");
    await expect(illustration.locator("img")).toHaveCSS("opacity", "1");
    await expect(illustration.locator("img")).toHaveCSS("animation-name", "none");
    await expect(illustration.locator("img")).toHaveJSProperty("complete", true);
    expect(await illustration.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const largeTextSections = await page.locator("main > section").evaluateAll((sections) =>
    sections.map((section) => ({
      name: section.id || "landing section",
      width: section.clientWidth,
      scrollWidth: section.scrollWidth,
    })),
  );
  for (const section of largeTextSections) {
    expect(section.scrollWidth, `${section.name} should fit at 200% text size`).toBeLessThanOrEqual(section.width + 1);
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const rows = await page.locator(".landing-reading-day__row").evaluateAll((elements) =>
      elements.map((element) => ({
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        artWidth: element.querySelector(".landing-reading-step-art")!.getBoundingClientRect().width,
      })),
    );
    for (const row of rows) {
      expect(row.scrollWidth, `Reading step should fit at ${width}px and 200% text`).toBeLessThanOrEqual(row.width + 1);
      expect(row.artWidth, "Decorative art stays small when text is enlarged").toBeLessThanOrEqual(72);
    }
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });

  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByText(/page error|something went wrong/i)).toHaveCount(0);
  expect(runtimeErrors, "The client should mount without an uncaught runtime error").toEqual([]);
});

test("landing sections reveal on scroll without changing the iPad or delaying keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".landing-hero")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#experience .landing-reveal")).toHaveCount(0);

  const methodEntrance = page.locator("#how-it-works .landing-reveal").first();
  await expect(methodEntrance).toHaveCSS("opacity", "0");

  for (const section of await page.locator("main > section:not(#experience)").all()) {
    const entrance = section.locator(".landing-reveal").first();
    await expect(entrance).toHaveCount(1);
    await entrance.scrollIntoViewIfNeeded();
    await expect(entrance).toHaveCSS("opacity", "1");
    await expect(entrance).toHaveCSS("transform", "none");
  }

  // Once revealed, content must not hide again when scrolling back.
  await page.locator(".landing-hero").scrollIntoViewIfNeeded();
  await expect(methodEntrance).toHaveCSS("opacity", "1");

  // Direct keyboard focus must bypass any pending entrance on the footer links.
  const support = page.getByRole("link", { name: "Support", exact: true });
  await support.focus();
  await expect(support.locator("..")).toHaveCSS("opacity", "1");
  await expect(support.locator("..")).toHaveCSS("transform", "none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const entrance of await page.locator(".landing-reveal").all()) {
    await expect(entrance).toHaveCSS("opacity", "1");
    await expect(entrance).toHaveCSS("transform", "none");
  }
});

test("onboarding stays usable across phone, tablet, and desktop", async ({ page }) => {
  // This test validates layout, not motion. Disabling decorative transitions also
  // prevents a cold CI worker from spending the assertion window on entrance animation.
  await page.emulateMedia({ reducedMotion: "reduce" });

  const viewports = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
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
    await page.goto("/onboarding?from=landing", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator(".onboarding-page"),
      "The public onboarding route should finish auth and draft bootstrap before layout assertions",
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator(".onboarding-action-dock svg"),
      "Onboarding actions should feel weighted without decorative arrows",
    ).toHaveCount(0);
    await expect(page.locator(".onboarding-logo").getByRole("button", { name: /skip/i }).locator("svg")).toHaveCount(0);

    for (const [index, heading] of chapterHeadings.entries()) {
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();

      const overflow = await page.locator(".onboarding-page").evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      const primaryAction = page.locator(".onboarding-action-dock").getByRole("button", {
        name: index === chapterHeadings.length - 1 ? /^(?:sign up|continue to sign up)$/i : /^continue$/i,
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

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding?from=landing", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: chapterHeadings[0], level: 1 })).toBeVisible({ timeout: 15_000 });

  const chapterDockBox = await page.locator(".onboarding-chapter-dock").boundingBox();
  const readerBox = await page.locator(".onboarding-reader").boundingBox();
  expect(chapterDockBox).not.toBeNull();
  expect(readerBox).not.toBeNull();
  expect(chapterDockBox!.x + chapterDockBox!.width).toBeLessThanOrEqual(readerBox!.x + 1);
  await expect(page.getByRole("navigation", { name: "Onboarding chapters" }).getByRole("button")).toHaveCount(6);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  const continueButton = page.locator(".onboarding-action-dock").getByRole("button", { name: "Continue" });
  await continueButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('.onboarding-page[data-motion="instant"]')).toBeVisible();

  await page.locator(".onboarding-action-dock").getByRole("button", { name: "Back" }).click();
  await expect(page.locator('.onboarding-page[data-motion="directional"]')).toBeVisible();
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
