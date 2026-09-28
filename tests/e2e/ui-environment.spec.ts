import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
});

for (const runtime of ["web", "ios", "android", "desktop", "unknown"]) {
  test(`F05 ${runtime} runtime has correct presentation and auth boundary at phone width`, async ({ page }) => {
    if (runtime === "desktop") await page.addInitScript(() => { window.brackDesktop = {} as NonNullable<Window["brackDesktop"]>; });
    await page.goto(`/?runtime=${runtime}`);
    const expected = runtime === "unknown" ? "web" : runtime;
    await expect(page.getByTestId("runtime")).toHaveText(expected);
    await expect(page.getByTestId("displayMode")).toHaveText(["web", "unknown"].includes(runtime) ? "browser" : "app");
    await expect(page.getByTestId("windowClass")).toHaveText("compact");
    await expect(page.getByTestId("legacy-platform")).toHaveText(["ios", "android"].includes(runtime) ? runtime : "web");
    await expect(page.getByTestId("auth-redirect")).toHaveText(["web", "unknown"].includes(runtime) ? "http://127.0.0.1:8089/auth/callback" : "brack://auth/callback");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
  });
}

test("F05 iPad desktop UA stays web and browser edge gestures remain browser owned", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" }));
  await page.goto("/");
  await expect(page.getByTestId("runtime")).toHaveText("web");
  await page.getByRole("link", { name: "Fixture detail" }).click();
  await page.evaluate(() => {
    const touch = (type: string, x: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { touches: [{ clientX: x, clientY: 100 }], changedTouches: [{ clientX: x, clientY: 100 }] });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    };
    if (touch("touchstart", 2) || touch("touchmove", 200)) throw new Error("Browser edge gesture was intercepted");
    touch("touchend", 200);
    touch("touchstart", window.innerWidth - 2);
    if (touch("touchmove", 20)) throw new Error("Browser forward edge gesture was intercepted");
    touch("touchend", 20);
  });
  await expect(page.getByTestId("drawers")).toHaveText("0");
  await expect(page).toHaveURL(/\/detail$/);
});

test("F05 split-view resize preserves the mounted reading draft and session", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.goto("/?runtime=ios");
  await page.getByRole("textbox", { name: "Reading note" }).fill("Keep this passage through split view");
  await page.getByRole("button", { name: "Read one page" }).click();
  const instance = await page.getByTestId("instance").textContent();
  for (const [width, windowClass, legacyPhone] of [[800, "medium", false], [700, "medium", true], [390, "compact", true], [1180, "expanded", false]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByTestId("windowClass")).toHaveText(windowClass);
    await expect(page.getByTestId("legacy-phone")).toHaveText(String(legacyPhone));
    await expect(page.getByTestId("runtime")).toHaveText("ios");
    await expect(page.getByTestId("instance")).toHaveText(instance!);
    await expect(page.getByRole("textbox", { name: "Reading note" })).toHaveValue("Keep this passage through split view");
    await expect(page.getByLabel("Session pages")).toHaveText("1");
  }
});

test("F05 keyboard-like viewport and pinch changes do not reclassify the window or resize the scroller", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { width: 800, height: 900, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
  });
  await page.goto("/?runtime=android");
  await page.getByRole("textbox", { name: "Reading note" }).fill("Keep the draft");
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { width: 400, height: 320, offsetTop: 24, offsetLeft: 10, scale: 2 });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.getByTestId("visualHeight")).toHaveText("320");
  await expect(page.getByTestId("visualScale")).toHaveText("2");
  await expect(page.getByTestId("visualOffsetTop")).toHaveText("24");
  await expect(page.getByTestId("windowClass")).toHaveText("medium");
  await expect(page.getByTestId("runtime")).toHaveText("android");
  await expect(page.getByTestId("layoutHeight")).toHaveText("900");
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--app-viewport-height"))).toBe("900px");
  await expect(page.getByRole("textbox", { name: "Reading note" })).toHaveValue("Keep the draft");
});

test("F05 standalone display mode updates reactively while retaining web auth", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    const standalone = Object.assign(new EventTarget(), { matches: false });
    window.matchMedia = (query) => query === "(display-mode: standalone)" ? standalone as MediaQueryList : original(query);
  });
  await page.goto("/");
  await page.evaluate(() => {
    const query = window.matchMedia("(display-mode: standalone)");
    Object.assign(query, { matches: true });
    query.dispatchEvent(new Event("change"));
  });
  await expect(page.getByTestId("displayMode")).toHaveText("standalone");
  await expect(page.getByTestId("runtime")).toHaveText("web");
  await expect(page.getByTestId("auth-surface")).toHaveText("pwa");
  await expect(page.getByTestId("auth-redirect")).toHaveText("http://127.0.0.1:8089/auth/callback");
  await page.evaluate(() => {
    const query = window.matchMedia("(display-mode: standalone)");
    Object.assign(query, { matches: false });
    query.dispatchEvent(new Event("change"));
  });
  await expect(page.getByTestId("displayMode")).toHaveText("browser");
});

test("F05 no optional media or viewport API still permits normal editing and navigation", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "matchMedia", { value: undefined, configurable: true });
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
  });
  await page.goto("/?runtime=unknown");
  await expect(page.getByTestId("runtime")).toHaveText("web");
  await expect(page.getByTestId("reducedMotion")).toHaveText("true");
  await expect(page.getByTestId("supportsMediaQueries")).toHaveText("false");
  await expect(page.getByTestId("supportsVisualViewport")).toHaveText("false");
  await expect(page.getByTestId("visualHeight")).toHaveText("844");
  await page.getByRole("textbox", { name: "Reading note" }).fill("Fallback still works");
  await page.getByRole("link", { name: "Fixture detail" }).click();
  await expect(page.getByRole("textbox", { name: "Reading note" })).toHaveValue("Fallback still works");
});

test("F05 OS reduced motion changes without remounting the draft", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Reading note" }).fill("A calm reading session");
  await expect(page.getByTestId("reducedMotion")).toHaveText("true");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.getByTestId("reducedMotion")).toHaveText("false");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("reducedMotion")).toHaveText("true");
  await expect(page.getByRole("textbox", { name: "Reading note" })).toHaveValue("A calm reading session");
});
