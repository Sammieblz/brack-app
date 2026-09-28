import { expect, test, type Page } from '@playwright/test';
import type { BackFixtureAPI } from '../fixtures/back-ownership/main';

type Snapshot = ReturnType<BackFixtureAPI['snapshot']>;
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => window.backOwnershipFixture.snapshot());
const ready = async (page: Page) => {
  await expect(page.getByTestId('fixture-ready')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.backOwnershipFixture))).toBe(true);
};
const open = async (page: Page, path = '/my-books') => { await page.goto(path); await ready(page); };
const path = (page: Page) => new URL(page.url()).pathname;
const toTask = async (page: Page) => {
  await page.getByRole('link', { name: 'Open The Lantern' }).click();
  await page.getByRole('link', { name: 'Edit reading note' }).click();
  await expect(page.getByRole('textbox', { name: 'Reading draft' })).toBeVisible();
};
const nativeBack = async (page: Page) => { await page.evaluate(() => window.backOwnershipFixture.nativeBack()); };

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => new URL(route.request().url()).origin === 'http://127.0.0.1:8091'
    ? route.continue() : route.abort());
});

test('positive foreign history index cannot make direct-entry app Back leave its safe parent', async ({ page }) => {
  await page.addInitScript(() => {
    window.history.replaceState({ idx: 19, key: 'foreign-entry' }, '', window.location.href);
  });
  await open(page, '/book/one');
  expect((await snapshot(page)).canGoBack).toBe(false);
  const before = await page.evaluate(() => window.history.length);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(() => path(page)).toBe('/my-books');
  expect(await page.evaluate(() => window.history.length)).toBe(before);
});

test('observed PUSH REPLACE reload POP and browser Forward retain known ancestry', async ({ page }) => {
  await open(page);
  await toTask(page);
  await page.getByRole('button', { name: 'Replace tab query' }).click();
  await expect(page).toHaveURL(/\/edit-book\/one\?view=notes$/);
  await page.reload();
  await ready(page);
  await expect.poll(async () => (await snapshot(page)).canGoBack).toBe(true);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(() => path(page)).toBe('/book/one');
  await page.goBack();
  await expect.poll(() => path(page)).toBe('/my-books');
  await page.goForward();
  await expect.poll(() => path(page)).toBe('/book/one');
  await page.goForward();
  await expect(page).toHaveURL(/\/edit-book\/one\?view=notes$/);
  await expect.poll(async () => (await snapshot(page)).canGoBack).toBe(true);
});

test('an unobserved history gap resets ancestry instead of skipping across it', async ({ page }) => {
  await open(page);
  await page.getByRole('link', { name: 'Open The Lantern' }).click();
  await expect.poll(async () => (await snapshot(page)).canGoBack).toBe(true);
  await page.evaluate(() => window.backOwnershipFixture.insertForeignGap());
  await expect.poll(async () => (await snapshot(page)).canGoBack).toBe(false);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(() => path(page)).toBe('/my-books');
});

test('browser Back stays browser Back while in-process draft and timer survive route changes', async ({ page }) => {
  await open(page);
  await toTask(page);
  await page.getByRole('textbox', { name: 'Reading draft' }).fill('Keep this reading thought');
  await page.evaluate(() => { window.backOwnershipFixture.setPending(true); window.backOwnershipFixture.advanceTimer(90); });
  await expect.poll(async () => (await snapshot(page)).elapsed).toBe(90);
  await page.goBack();
  await expect.poll(() => path(page)).toBe('/book/one');
  expect(await snapshot(page)).toMatchObject({ draft: 'Keep this reading thought', elapsed: 90, guardChecks: 0 });
  await page.goForward();
  await expect(page.getByRole('textbox', { name: 'Reading draft' })).toHaveValue('Keep this reading thought');
  await expect(page.getByRole('status', { name: 'Save status' })).toHaveText('Saving on this device…');
});

test('task Back consumes pending writes once then honors keep and discard decisions', async ({ page }) => {
  await open(page);
  await toTask(page);
  await page.getByRole('textbox', { name: 'Reading draft' }).fill('Pending draft');
  await page.evaluate(() => window.backOwnershipFixture.setPending(true));
  await expect(page.getByRole('status', { name: 'Save status' })).toHaveText('Saving on this device…');
  await page.evaluate(() => { window.backOwnershipFixture.appBack(); window.backOwnershipFixture.appBack(); });
  await expect.poll(async () => (await snapshot(page)).guardChecks).toBe(1);
  expect(path(page)).toBe('/edit-book/one');
  await page.evaluate(() => window.backOwnershipFixture.setPending(false));
  await expect(page.getByRole('status', { name: 'Save status' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave this draft?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Reading draft' })).toHaveValue('Pending draft');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Discard and go back' }).click();
  await expect.poll(() => path(page)).toBe('/book/one');
  await expect.poll(async () => (await snapshot(page)).draft).toBe('');
});

test('a late task confirmation cannot navigate after browser POP or account change', async ({ page }) => {
  await open(page);
  await toTask(page);
  await page.getByRole('textbox', { name: 'Reading draft' }).fill('First draft');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave this draft?' })).toBeVisible();
  await page.goBack();
  await expect.poll(() => path(page)).toBe('/book/one');
  await page.evaluate(() => window.backOwnershipFixture.resolveGuard(true));
  await expect.poll(async () => (await snapshot(page)).draft).toBe('');
  expect(path(page)).toBe('/book/one');
  await page.getByRole('link', { name: 'Edit reading note' }).click();
  await page.getByRole('textbox', { name: 'Reading draft' }).fill('Another draft');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave this draft?' })).toBeVisible();
  await page.evaluate(() => window.backOwnershipFixture.changeAccount());
  await expect.poll(async () => (await snapshot(page)).account).toBe('reader-b');
  await page.evaluate(() => window.backOwnershipFixture.resolveGuard(true));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(path(page)).toBe('/edit-book/one');
  expect((await snapshot(page)).canGoBack).toBe(false);
});

test('native Back closes only the nested surface before dirty and pending editor guards', async ({ page }) => {
  await open(page, '/book/one?runtime=android');
  await expect.poll(async () => (await snapshot(page)).native.active).toBe(1);
  await page.getByRole('button', { name: 'Open note editor' }).click();
  await page.getByRole('textbox', { name: 'Book note' }).fill('Do not lose this');
  const date = page.getByRole('button', { name: 'Date options', exact: true });
  await date.click();
  await expect(page.getByText('Nested date options')).toBeVisible();
  await nativeBack(page);
  await expect(page.getByText('Nested date options')).toHaveCount(0);
  await expect(date).toBeFocused();
  const kind = page.getByRole('combobox', { name: 'Note kind' });
  await kind.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await nativeBack(page);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(kind).toBeFocused();
  await page.getByRole('button', { name: 'More note actions' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await nativeBack(page);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await nativeBack(page);
  await expect(page.getByRole('region', { name: 'Discard note confirmation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep note' })).toBeFocused();
  await page.getByRole('button', { name: 'Keep note' }).click();
  await page.evaluate(() => window.backOwnershipFixture.setOverlayPending(true));
  await expect(page.getByRole('status', { name: 'Note save status' })).toHaveText('Saving note…');
  await nativeBack(page);
  await expect(page.getByRole('region', { name: 'Discard note confirmation' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Book note' })).toHaveValue('Do not lose this');
  await page.evaluate(() => window.backOwnershipFixture.setOverlayPending(false));
  await expect(page.getByRole('textbox', { name: 'Book note' })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Book note' }).fill('');
  await nativeBack(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await snapshot(page)).overlayCloses).toBe(1);
  expect(path(page)).toBe('/book/one');
  await nativeBack(page);
  await expect.poll(() => path(page)).toBe('/my-books');
});

test('Escape retains draft guards and focus without turning into route Back', async ({ page }) => {
  await open(page, '/book/one');
  const trigger = page.getByRole('button', { name: 'Open note editor' });
  await trigger.focus();
  await trigger.click();
  await page.getByRole('textbox', { name: 'Book note' }).fill('Unfinished note');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Keep note' })).toBeFocused();
  await page.getByRole('button', { name: 'Discard note' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Escape');
  expect(path(page)).toBe('/book/one');
  expect((await snapshot(page)).overlayCloses).toBe(1);
});

test('overlay then selection then native root minimization each consume one separate Back', async ({ page }) => {
  await open(page, '/my-books?runtime=android');
  await page.getByRole('button', { name: 'Select books' }).click();
  await page.getByRole('button', { name: 'Open note editor' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await nativeBack(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await snapshot(page)).toMatchObject({ selection: true, selectionClears: 0, native: { minimized: 0 } });
  await nativeBack(page);
  await expect(page.getByRole('status', { name: 'Selection status' })).toHaveText('No selection');
  expect(await snapshot(page)).toMatchObject({ selectionClears: 1, native: { minimized: 0 } });
  await page.evaluate(() => window.backOwnershipFixture.advanceTimer(61));
  await expect.poll(async () => (await snapshot(page)).elapsed).toBe(61);
  await nativeBack(page);
  await expect.poll(async () => (await snapshot(page)).native.minimized).toBe(1);
  expect(path(page)).toBe('/my-books');
  expect((await snapshot(page)).elapsed).toBe(61);
});

test('native listener setup cleans up late registration and remounts without duplicate actions', async ({ page }) => {
  await open(page, '/my-books?runtime=android&delayNativeRegistration=1');
  await expect.poll(async () => (await snapshot(page)).native.added).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.backOwnershipFixture.releaseNativeRegistration());
  await expect.poll(async () => (await snapshot(page)).native.active).toBe(1);
  await page.evaluate(() => window.backOwnershipFixture.remount());
  await expect.poll(async () => {
    const { native } = await snapshot(page); return native.active === 1 && native.removed === native.added - 1;
  }).toBe(true);
  await nativeBack(page);
  await expect.poll(async () => (await snapshot(page)).native.minimized).toBe(1);
});

test('native Back honors the visible explicit callback and destination in the same order as UI', async ({ page }) => {
  await open(page, '/book/one?runtime=android');
  await page.evaluate(() => window.backOwnershipFixture.setBackMode('callback'));
  await expect.poll(async () => (await snapshot(page)).backMode).toBe('callback');
  await nativeBack(page);
  await expect.poll(async () => (await snapshot(page)).callbacks).toBe(1);
  expect(path(page)).toBe('/book/one');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).callbacks).toBe(2);
  await page.evaluate(() => window.backOwnershipFixture.setBackMode('to'));
  await expect.poll(async () => (await snapshot(page)).backMode).toBe('to');
  await nativeBack(page);
  await expect.poll(() => path(page)).toBe('/lists');
  expect((await snapshot(page)).native.minimized).toBe(0);
});

for (const presentation of [
  { width: 390, height: 844, runtime: 'android', extra: '' },
  { width: 834, height: 1112, runtime: 'ios', extra: '&theme=dark&palette=default&text=200' },
  { width: 1280, height: 900, runtime: 'web', extra: '' },
]) {
  test(`Back remains reachable at ${presentation.width}px ${presentation.runtime} with theme and reduced motion`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: presentation.width, height: presentation.height });
    await open(page, `/book/one?runtime=${presentation.runtime}${presentation.extra}`);
    const back = page.getByRole('button', { name: 'Back', exact: true });
    await expect(back).toBeVisible();
    await back.focus();
    await expect(back).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    if (presentation.extra) {
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath('back-presentation.png'), fullPage: true });
    await back.press('Enter');
    await expect.poll(() => path(page)).toBe('/my-books');
    if (presentation.runtime !== 'android') expect((await snapshot(page)).native.added).toBe(0);
  });
}
