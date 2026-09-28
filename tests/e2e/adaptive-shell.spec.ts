import { expect, test, type Page, type Locator } from '@playwright/test';
import type { AdaptiveShellFixtureAPI } from '../fixtures/adaptive-shell/main';

const origin = 'http://127.0.0.1:8093';
const errors = new WeakMap<Page, string[]>();
const shell = (page: Page) => page.locator('[data-shell-navigation]');
const scroller = (page: Page) => page.locator('[data-app-scroll-container]');
const menu = (page: Page) => page.getByRole('dialog', { name: 'Your reading space' });
const menuButton = (page: Page) => page.getByRole('button', { name: 'Menu', exact: true });
const snapshot = (page: Page): Promise<ReturnType<AdaptiveShellFixtureAPI['snapshot']>> => page.evaluate(() => window.adaptiveShellFixture!.snapshot());
async function open(page: Page, query = '', route = '/my-books') {
  await page.goto(`${route}${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(scroller(page)).toHaveCount(1);
  if (route === '/my-books') await expect(page.getByRole('heading', { name: /^(My )?Library$/, level: 1 })).toBeVisible();
}
async function deviceInput(page: Page, { coarse = true, standalone = false } = {}) {
  await page.addInitScript(({ coarse, standalone }) => {
    const original = window.matchMedia.bind(window);
    const queries = new Map<string, MediaQueryList>();
    window.matchMedia = (query) => {
      const overrides: Record<string, boolean> = { '(pointer: coarse)': coarse, '(any-pointer: coarse)': coarse,
        '(pointer: fine)': !coarse, '(any-pointer: fine)': !coarse, '(hover: hover)': !coarse,
        '(any-hover: hover)': !coarse, '(display-mode: standalone)': standalone };
      if (!(query in overrides)) return original(query);
      if (!queries.has(query)) queries.set(query, Object.assign(new EventTarget(), {
        media: query, matches: overrides[query], onchange: null,
      }) as MediaQueryList);
      return queries.get(query)!;
    };
  }, { coarse, standalone });
}
async function noHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ window: window.innerWidth,
    document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
    scroll: document.querySelector<HTMLElement>('[data-app-scroll-container]')!.scrollWidth,
    available: document.querySelector<HTMLElement>('[data-app-scroll-container]')!.clientWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.window + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.window + 1);
  expect(widths.scroll).toBeLessThanOrEqual(widths.available + 1);
}
async function visibleInsideViewport(locator: Locator, page: Page) {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.y).toBeGreaterThanOrEqual(-1);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
}
test.beforeEach(async ({ page }) => {
  const captured: string[] = [];
  errors.set(page, captured);
  page.on('pageerror', (error) => captured.push(error.message));
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
});
test.afterEach(async ({ page }) => { expect(errors.get(page), 'No uncaught errors in real shell consumers').toEqual([]); });

for (const profile of [
  { name: 'phone-browser', width: 390, height: 844, runtime: 'web', navigation: 'menu', coarse: true },
  { name: 'phone-android', width: 390, height: 844, runtime: 'android', navigation: 'tabs', coarse: true },
  { name: 'phone-pwa', width: 390, height: 844, runtime: 'web', navigation: 'tabs', coarse: true, standalone: true },
  { name: 'tablet-ios', width: 834, height: 1112, runtime: 'ios', navigation: 'tabs', coarse: true },
  { name: 'tablet-browser', width: 834, height: 1112, runtime: 'web', navigation: 'menu', coarse: true },
  { name: 'expanded-tablet', width: 1024, height: 768, runtime: 'ios', navigation: 'sidebar', coarse: true },
  { name: 'desktop-browser', width: 1440, height: 900, runtime: 'web', navigation: 'sidebar', coarse: false },
] as const) {
  test(`${profile.name}: real Library has the intended navigation and one unobscured scroller`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await deviceInput(page, { coarse: profile.coarse, standalone: 'standalone' in profile && profile.standalone });
    await open(page, `?runtime=${profile.runtime}`);
    await expect(shell(page)).toHaveAttribute('data-shell-navigation', profile.navigation);
    expect((await snapshot(page)).environment.runtime).toBe(profile.runtime);
    if (profile.navigation === 'menu') {
      await expect(menuButton(page)).toBeVisible();
      await expect(page.locator('[data-shell-footer] a[href="/my-books"]')).toHaveCount(0);
    } else if (profile.navigation === 'tabs') {
      const tab = page.locator('[data-shell-footer] a[href="/my-books"]');
      await expect(tab).toHaveAttribute('aria-current', 'page');
      await expect(tab).toContainText('Library');
      await visibleInsideViewport(tab, page);
      const footer = await page.locator('[data-shell-footer]').boundingBox();
      expect(Math.abs(footer!.y + footer!.height - profile.height)).toBeLessThanOrEqual(1);
    } else {
      await expect(page.locator('[data-sidebar="sidebar"]')).toBeVisible();
      await expect(menuButton(page)).toHaveCount(0);
    }
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${profile.name}-library.png`), animations: 'disabled' });
    await scroller(page).evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => scroller(page).evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const footer = page.locator('[data-shell-footer]');
    if (await footer.count()) {
      const scrollBounds = await scroller(page).boundingBox();
      const footerBounds = await footer.boundingBox();
      if (footerBounds?.height) expect(scrollBounds!.y + scrollBounds!.height).toBeLessThanOrEqual(footerBounds.y + 1);
    }
  });
}

test('browser menu exposes destinations, restores focus and closes after real link navigation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await open(page);
  await menuButton(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  for (const name of ['Home', 'Library', 'Lists', 'Analytics', 'Goals', 'Journey', 'Feed', 'Readers', 'Clubs', 'Messages', 'Reviews', 'Profile', 'Settings']) {
    await expect(menu(page).getByRole('link', { name, exact: true })).toHaveCount(1);
  }
  await page.screenshot({ path: testInfo.outputPath('phone-browser-menu.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
  await menuButton(page).click();
  await menu(page).getByRole('link', { name: 'Lists', exact: true }).click();
  await expect(page.getByTestId('destination-path')).toHaveText('/lists');
  await expect(menu(page)).toHaveCount(0);
});

test('social gating removes community destinations from both native tabs and the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await open(page, '?runtime=android&social=off');
  await expect(page.locator('[data-shell-footer] a')).toHaveCount(3);
  await menuButton(page).click();
  for (const name of ['Feed', 'Readers', 'Clubs', 'Messages', 'Reviews']) {
    await expect(menu(page).getByRole('link', { name, exact: true })).toHaveCount(0);
  }
  await expect(menu(page).getByRole('link', { name: 'Library', exact: true })).toBeVisible();
  await page.evaluate(() => window.adaptiveShellFixture!.back());
  await expect(menu(page)).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
  expect((await snapshot(page)).native.minimized).toBe(0);
});

test('real Library search draft remains mounted through phone, tablet and sidebar boundaries', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await open(page, '?runtime=ios');
  const search = page.getByRole('searchbox', { name: 'Search your library' });
  await search.fill('Reading collection 2');
  const original = await search.elementHandle();
  for (const width of [834, 1024, 1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(search).toHaveValue('Reading collection 2');
    expect(await search.evaluate((node, previous) => node === previous, original)).toBe(true);
    await expect(search).toBeFocused();
    await noHorizontalOverflow(page);
  }
});

test('task node, caret and draft survive resizing; editing hides irrelevant footer until focus leaves', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await open(page, '?runtime=android&timer&offline', '/note');
  const input = page.getByRole('textbox', { name: 'Reading draft' });
  const instance = await page.getByRole('status', { name: 'Task instance' }).textContent();
  await input.fill('A note carried through every shell');
  await input.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(2, 8));
  const original = await input.elementHandle();
  for (const width of [834, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(shell(page)).toHaveAttribute('data-shell-editing', 'true');
    await expect(page.locator('[data-shell-footer]')).toBeHidden();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('A note carried through every shell');
    expect(await input.evaluate((element, previous) => element === previous, original)).toBe(true);
    expect(await input.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([2, 8]);
    await expect(page.getByRole('status', { name: 'Task instance' })).toHaveText(instance!);
  }
  await page.getByRole('heading', { name: 'Reading note' }).click();
  await expect(shell(page)).toHaveAttribute('data-shell-editing', 'false');
  await expect(page.locator('[data-shell-footer]')).toBeVisible();
});

test('menu stays mounted through header replacement and Escape restores the current trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await open(page);
  await menuButton(page).click();
  const original = await menu(page).elementHandle();
  await page.setViewportSize({ width: 834, height: 1112 });
  await expect(menu(page)).toBeVisible();
  expect(await menu(page).evaluate((node, previous) => node === previous, original)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(menuButton(page)).toBeFocused();
  await menuButton(page).click();
  const expandedOriginal = await menu(page).elementHandle();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(menu(page)).toBeVisible();
  expect(await menu(page).evaluate((node, previous) => node === previous, expandedOriginal)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'My Library', level: 1 })).toBeFocused();
});

test('active timer and offline status occupy normal flow without covering final content', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await open(page, '?runtime=android&timer&offline', '/note');
  await expect(page.getByText(/You're offline/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume timer', exact: true })).toBeVisible();
  expect((await snapshot(page)).timer.isRunning).toBe(false);
  await scroller(page).evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const action = page.getByRole('button', { name: 'Save final observation' });
  await expect(action).toBeInViewport();
  const actionRect = await action.boundingBox();
  const footerRect = await page.locator('[data-shell-footer]').boundingBox();
  expect(actionRect!.y + actionRect!.height).toBeLessThanOrEqual(footerRect!.y + 1);
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('phone-timer-offline.png'), animations: 'disabled' });
  const details = page.getByRole('button', { name: 'Open timer details' });
  await details.click();
  const dialog = page.getByRole('dialog', { name: 'Reading session' });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => window.adaptiveShellFixture!.back());
  await expect(dialog).toHaveCount(0);
  await expect(details).toBeFocused();
  await details.click();
  await dialog.getByRole('button', { name: 'Finish session' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Active reading session' })).toHaveCount(0);
  expect((await snapshot(page)).finished).toBe(1);
  expect((await snapshot(page)).cancelled).toBe(0);
});

test('large text retains all tab labels and menu destinations without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await open(page, '?runtime=android&text=200&theme=dark');
  const links = page.locator('[data-shell-footer] a');
  await expect(links).toHaveCount(5);
  for (const link of await links.all()) {
    await visibleInsideViewport(link, page);
    expect(await link.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await noHorizontalOverflow(page);
  await menuButton(page).click();
  const settings = menu(page).getByRole('link', { name: 'Settings', exact: true });
  await settings.scrollIntoViewIfNeeded();
  await expect(settings).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('phone-large-text-menu.png'), animations: 'disabled' });
  await settings.click();
  await expect(page.getByTestId('destination-path')).toHaveText('/settings');
});

test('visual viewport shrink reserves available space; pinch does not change shell choice or draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { width: 390, height: 844, offsetLeft: 0, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  });
  await open(page, '?runtime=android', '/note');
  const input = page.getByRole('textbox', { name: 'Reading draft' });
  await input.fill('Keyboard geometry is not a runtime');
  await page.evaluate(() => { Object.assign(window.visualViewport!, { height: 430, offsetTop: 20 }); window.visualViewport!.dispatchEvent(new Event('resize')); });
  await expect.poll(async () => (await shell(page).boundingBox())!.height).toBeLessThanOrEqual(430);
  await expect(shell(page)).toHaveAttribute('data-shell-navigation', 'tabs');
  await expect(input).toBeFocused();
  await page.evaluate(() => { Object.assign(window.visualViewport!, { height: 422, scale: 2 }); window.visualViewport!.dispatchEvent(new Event('resize')); });
  await expect.poll(async () => (await shell(page).boundingBox())!.height).toBe(844);
  await expect(input).toHaveValue('Keyboard geometry is not a runtime');
});

test('width-only reflow keeps the focused field clear of the sticky header', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 844 });
  await deviceInput(page);
  await open(page, '?runtime=ios', '/note');
  const input = page.getByRole('textbox', { name: 'Reading draft' });
  await input.fill('Reflow must not hide this thought');
  const original = await input.elementHandle();
  await scroller(page).evaluate((owner) => {
    const field = owner.querySelector('textarea')!;
    const header = owner.querySelector('header')!;
    owner.scrollTop += field.getBoundingClientRect().top - header.getBoundingClientRect().bottom - 16;
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(input).toBeFocused();
  await expect.poll(() => input.evaluate((field) => {
    const header = field.closest('[data-app-scroll-container]')!.querySelector('header')!;
    return field.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
  })).toBeGreaterThanOrEqual(0);
  expect(await input.evaluate((field, previous) => field === previous, original)).toBe(true);
  await expect(input).toHaveValue('Reflow must not hide this thought');
});

for (const task of [
  { path: '/add-book', manual: true, save: 'Save Book' },
  { path: '/edit-book/fixture-book-0', manual: false, save: 'Save Changes' },
]) {
  test(`${task.path}: real form keeps its draft and save action clear of native phone and tablet chrome`, async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1112 });
    await deviceInput(page);
    await open(page, '?runtime=ios&timer&offline', task.path);
    await expect(menuButton(page)).toBeVisible();
    if (task.manual) await page.getByRole('tab', { name: 'Manual', exact: true }).click();
    const title = page.getByRole('textbox', { name: /^Title(?: \*)?$/ });
    await title.fill('A draft that keeps its place');
    const original = await title.elementHandle();
    await expect(page.locator('[data-shell-footer]')).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(title).toHaveValue('A draft that keeps its place');
    expect(await title.evaluate((field, previous) => field === previous, original)).toBe(true);
    await title.evaluate((field: HTMLInputElement) => field.blur());
    await expect(page.locator('[data-shell-footer]')).toBeVisible();
    const save = page.getByRole('button', { name: task.save, exact: true });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeEnabled();
    await expect(save).toBeInViewport();
    const saveBounds = await save.boundingBox();
    const footerBounds = await page.locator('[data-shell-footer]').boundingBox();
    expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(footerBounds!.y + 1);
    await noHorizontalOverflow(page);
    // F09 verifies composition, not persistence; no create/update is invoked.
  });
}

test('timer controls keep their DOM across routes and a finished session gives focus to the real journal prompt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await open(page, '?runtime=android&timer&journalPrompt');
  const timer = page.getByRole('region', { name: 'Active reading session' });
  const original = await timer.elementHandle();
  await page.locator('[data-shell-footer] a[href="/lists"]').click();
  await expect(page.getByTestId('destination-path')).toHaveText('/lists');
  expect(await timer.evaluate((node, previous) => node === previous, original)).toBe(true);
  expect((await snapshot(page)).timer.time).toBe(1325);
  await page.getByRole('button', { name: 'Open timer details' }).click();
  await page.getByRole('dialog', { name: 'Reading session' }).getByRole('button', { name: 'Finish session' }).click();
  const journal = page.getByRole('dialog', { name: 'Add Journal Entry' });
  await expect(journal).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect.poll(() => journal.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await expect(timer).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect.poll(() => journal.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await journal.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(journal).toHaveCount(0);
  expect((await snapshot(page)).finished).toBe(1);
});

test('320px with large text keeps combined utilities and quick-action tasks reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await deviceInput(page);
  await open(page, '?runtime=android&text=200&timer&offline');
  const footer = page.locator('[data-shell-footer]');
  for (const action of [page.getByRole('button', { name: 'Pause timer', exact: true }),
    page.getByRole('button', { name: 'Open timer details' }), footer.getByRole('link', { name: 'Readers', exact: true })]) {
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
  }
  expect((await scroller(page).boundingBox())!.height).toBeGreaterThan(150);
  await noHorizontalOverflow(page);
  const trigger = page.getByRole('button', { name: 'Quick actions', exact: true });
  await trigger.click();
  const actions = page.getByRole('dialog', { name: 'Quick actions', exact: true });
  await expect(actions).toBeVisible();
  await actions.getByRole('button', { name: 'Start Reading Timer', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Start reading timer', exact: true });
  await expect(picker).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await picker.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await actions.getByRole('button', { name: 'Quick Stats', exact: true }).click();
  const stats = page.getByRole('dialog', { name: 'Quick stats', exact: true });
  await expect(stats).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await stats.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(trigger).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('narrow-large-text-utilities.png'), animations: 'disabled' });
});

test('forced colors and live reduced motion keep visible menu focus without ornamental animation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceInput(page);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await open(page);
  await menuButton(page).click();
  const library = menu(page).getByRole('link', { name: 'Library', exact: true });
  await library.focus();
  await expect(library).toBeFocused();
  await expect(library).toHaveCSS('outline-style', 'solid');
  const original = await menu(page).elementHandle();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(async () => (await snapshot(page)).environment.reducedMotion).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await snapshot(page)).environment.reducedMotion).toBe(true);
  expect(await menu(page).evaluate((dialog, previous) => dialog === previous, original)).toBe(true);
  expect(await menu(page).evaluate((dialog) => dialog.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(menuButton(page)).toBeFocused();
});
