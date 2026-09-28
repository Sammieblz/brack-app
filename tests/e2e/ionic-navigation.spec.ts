import { writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { IonicNavigationSnapshot } from '../fixtures/ionic-fit/navigation';

const snapshot = (page: Page): Promise<IonicNavigationSnapshot> => page.evaluate(() => window.ionicNavigationFixture.snapshot());
async function attachEvidence(testInfo: TestInfo, name: string, value: unknown) {
  const path = testInfo.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: 'application/json' });
}
const activePage = (page: Page) => page.locator('.fixture-page').filter({ visible: true });
async function settled(page: Page, name: string) {
  await page.waitForFunction(() => Boolean(window.ionicNavigationFixture));
  // Visual/URL readiness is separate from the known Ionic 9 lifecycle gate.
  await expect(activePage(page)).toHaveAttribute('data-page', name);
  await expect.poll(async () => (await snapshot(page)).visiblePages).toBe(1);
}
async function load(page: Page, route = '/library', query = 'runtime=native&mode=ios') {
  await page.goto(`/navigation.html${route}?${query}`);
  await page.waitForFunction(() => Boolean(window.ionicNavigationFixture));
  await expect.poll(async () => (await snapshot(page)).activePages.length).toBe(1);
}
async function tab(page: Page, name: 'Library' | 'Reading') {
  await page.getByRole('tab', { name, exact: true }).click();
}
async function scrollPosition(page: Page) {
  return activePage(page).locator('ion-content').evaluate(async (content: HTMLIonContentElement) => (await content.getScrollElement()).scrollTop);
}

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ context, page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', (route) => new URL(route.request().url()).origin === 'http://127.0.0.1:8090' ? route.continue() : route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page), 'No uncaught fixture errors').toEqual([]); });

test('Ionic route links preserve URL, browser Back/Forward and direct reload', async ({ page }) => {
  await load(page, '/library', 'runtime=browser&mode=md');
  await settled(page, 'library');
  const book = page.getByRole('link', { name: 'Open reading book 1', exact: true });
  await expect(book).toHaveAttribute('href', '/navigation.html/library/book/1?runtime=browser&mode=md');
  await book.focus(); await book.press('Enter');
  await settled(page, 'book-1');
  await expect(page).toHaveURL(/\/navigation\.html\/library\/book\/1\?runtime=browser&mode=md$/);
  await page.goBack(); await settled(page, 'library');
  await page.goForward(); await settled(page, 'book-1');
  await page.reload(); await settled(page, 'book-1');
  await expect(page.getByRole('heading', { name: 'Reading book 1', exact: true })).toBeVisible();
});

for (const entry of [{ route: '/library/book/3', page: 'book-3', fallback: 'library' }, { route: '/reading/session', page: 'session', fallback: 'reading' }]) {
  test(`direct ${entry.page} entry has a safe in-app Back fallback`, async ({ page }) => {
    await load(page, entry.route);
    await settled(page, entry.page);
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await settled(page, entry.fallback);
    await expect(page).toHaveURL(new RegExp(`/navigation\\.html/${entry.fallback}\\?runtime=native&mode=ios$`));
  });
}

test('independent tabs retain book/session histories, shared draft and synthetic timer', async ({ page }) => {
  await load(page); await settled(page, 'library');
  const owner = (await snapshot(page)).readerOwner;
  await page.getByRole('link', { name: 'Open reading book 1', exact: true }).click(); await settled(page, 'book-1');
  await page.getByRole('textbox', { name: 'Reading note', exact: true }).fill('Keep this thought through a tab switch.');
  await page.getByRole('button', { name: 'Start reading timer', exact: true }).click();
  await page.evaluate(() => window.ionicNavigationFixture.advanceTimer(61));
  await expect.poll(async () => (await snapshot(page)).timer).toEqual({ running: true, elapsedSeconds: 61 });
  await tab(page, 'Reading'); await settled(page, 'reading');
  await page.getByRole('link', { name: 'Open reading session', exact: true }).click(); await settled(page, 'session');
  await tab(page, 'Library'); await settled(page, 'book-1');
  await expect(page.getByRole('textbox', { name: 'Reading note', exact: true })).toHaveValue('Keep this thought through a tab switch.');
  await tab(page, 'Reading'); await settled(page, 'session');
  await expect(page.getByTestId('session-draft')).toHaveText('Keep this thought through a tab switch.');
  await page.evaluate(() => window.ionicNavigationFixture.advanceTimer(29));
  await expect.poll(async () => (await snapshot(page)).timer).toEqual({ running: true, elapsedSeconds: 90 });
  expect((await snapshot(page)).readerOwner).toBe(owner);
  await page.getByRole('button', { name: 'Go back', exact: true }).click(); await settled(page, 'reading');
  await tab(page, 'Library'); await settled(page, 'book-1');
});

test('the retained Library restores its own long scroll with one page scroller', async ({ page }) => {
  await load(page); await settled(page, 'library');
  const book = page.getByRole('link', { name: 'Open reading book 30', exact: true });
  await book.scrollIntoViewIfNeeded();
  const before = await scrollPosition(page);
  expect(before).toBeGreaterThan(1000);
  await book.click(); await settled(page, 'book-30');
  await page.getByRole('button', { name: 'Go back', exact: true }).click(); await settled(page, 'library');
  await expect.poll(async () => Math.abs((await scrollPosition(page)) - before)).toBeLessThan(3);
  const geometry = await activePage(page).locator('ion-content').evaluate(async (content: HTMLIonContentElement) => {
    const scroll = await content.getScrollElement();
    return { scrollable: scroll.scrollHeight > scroll.clientHeight, bodyTop: document.scrollingElement?.scrollTop,
      bodyOverflows: document.documentElement.scrollWidth > window.innerWidth,
      contentOverflow: getComputedStyle(scroll).overflowY, bodyOverflow: getComputedStyle(document.body).overflowY };
  });
  expect(geometry).toMatchObject({ scrollable: true, bodyTop: 0, bodyOverflows: false, contentOverflow: 'auto', bodyOverflow: 'hidden' });
});

test('bounded retained pages remain outside the keyboard tab order', async ({ page }, testInfo) => {
  await load(page); await settled(page, 'library');
  await page.getByRole('link', { name: 'Open reading book 1', exact: true }).click(); await settled(page, 'book-1');
  await tab(page, 'Reading'); await settled(page, 'reading');
  await page.getByRole('link', { name: 'Open reading session', exact: true }).click(); await settled(page, 'session');
  const before = await snapshot(page);
  for (let index = 0; index < 6; index += 1) {
    await tab(page, 'Library'); await settled(page, 'book-1');
    await tab(page, 'Reading'); await settled(page, 'session');
  }
  const after = await snapshot(page);
  expect(after.retainedPages).toBe(before.retainedPages);
  expect(after.retainedPages).toBeLessThanOrEqual(4);
  await expect(page.getByRole('textbox', { name: 'Reading note', exact: true })).toHaveCount(0);
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => {
      let focused = document.activeElement;
      while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
      const owner = focused?.closest('.fixture-page');
      return !owner || (owner.getAttribute('aria-hidden') !== 'true' && getComputedStyle(owner).display !== 'none');
    })).toBe(true);
  }
  await attachEvidence(testInfo, 'synthetic-navigation-retention-and-timing', { before, after });
});

test('ADOPTION GATE: tab switches stop hidden-page subscriptions and enter the visible page', async ({ page }, testInfo) => {
  await load(page); await settled(page, 'library');
  await page.getByRole('link', { name: 'Open reading book 1', exact: true }).click(); await settled(page, 'book-1');
  await expect.poll(async () => (await snapshot(page)).activePages).toEqual(['book-1']);
  await page.getByRole('textbox', { name: 'Reading note', exact: true }).fill('Lifecycle probe');
  const before = await snapshot(page);
  await tab(page, 'Reading'); await settled(page, 'reading');
  await page.evaluate(() => window.ionicNavigationFixture.pulseSubscriptions());
  const after = await snapshot(page);
  const dom = await page.evaluate(() => ({
    pages: [...document.querySelectorAll<HTMLElement>('.fixture-page')].map((element) => ({
      name: element.dataset.page, display: getComputedStyle(element).display, hidden: element.getAttribute('aria-hidden'),
    })),
    focusedTag: document.activeElement?.tagName,
    focusedText: document.activeElement?.textContent?.slice(0, 120),
  }));
  await attachEvidence(testInfo, 'ionic-9-0-5-missing-tab-lifecycle', { before, after, dom });
  // Keep the desired contract red. Source: @ionic/react-router 9.0.5,
  // StackManager.transitionPage's direction=none branch skips commit() and
  // swaps visibility without dispatching page enter/leave lifecycle events.
  test.fail(true, 'Ionic 9.0.5 tab switches skip page lifecycle events: hidden subscriptions remain active and visible-page enter focus does not run. Router adoption is blocked.');
  expect(after.activePages).toEqual(['reading']);
  await expect(page.getByRole('heading', { name: 'Reading', exact: true })).toBeFocused();
});

test('already-loaded navigation works offline without resetting reading state', async ({ page, context }) => {
  await load(page); await settled(page, 'library');
  await page.getByRole('link', { name: 'Open reading book 1', exact: true }).click(); await settled(page, 'book-1');
  await page.getByRole('textbox', { name: 'Reading note', exact: true }).fill('A note without a network.');
  await context.setOffline(true);
  await tab(page, 'Reading'); await settled(page, 'reading');
  await page.getByRole('link', { name: 'Open reading session', exact: true }).click(); await settled(page, 'session');
  await expect(page.getByTestId('session-draft')).toHaveText('A note without a network.');
  await tab(page, 'Library'); await settled(page, 'book-1');
  await expect(page.getByRole('textbox', { name: 'Reading note', exact: true })).toHaveValue('A note without a network.');
  await context.setOffline(false);
});

for (const presentation of [{ runtime: 'native', mode: 'ios', slot: 'bottom', width: 390 }, { runtime: 'native', mode: 'md', slot: 'bottom', width: 834 }, { runtime: 'browser', mode: 'md', slot: 'top', width: 1280 }]) {
  test(`${presentation.runtime} ${presentation.mode} ${presentation.width}px presentation keeps tokens, semantics and reduced motion`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: presentation.width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await load(page, '/library', `runtime=${presentation.runtime}&mode=${presentation.mode}&theme=dark`);
    await settled(page, 'library');
    await expect(page.locator('ion-tab-bar')).toHaveAttribute('slot', presentation.slot);
    expect(await page.locator('ion-app').evaluate((element) => getComputedStyle(element).getPropertyValue('--ion-background-color').trim())).toMatch(/^hsl\(/);
    expect(await page.getByRole('heading', { name: 'Library', exact: true }).evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Playfair Display');
    expect((await snapshot(page)).mode).toBe(presentation.mode);
    expect((await snapshot(page)).runtime).toBe(presentation.runtime);
    expect((await snapshot(page)).reducedMotion).toBe(false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await snapshot(page)).reducedMotion).toBe(true);
    await expect.poll(async () => page.locator('ion-router-outlet').evaluate((outlet: HTMLIonRouterOutletElement) => outlet.animated)).toBe(false);
    const screenshot = testInfo.outputPath('navigation.png');
    await page.screenshot({ path: screenshot });
    await testInfo.attach('navigation-screenshot', { path: screenshot, contentType: 'image/png' });
  });
}
