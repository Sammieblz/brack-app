import { expect, test, type Page } from '@playwright/test';
import type {} from '../fixtures/reading-session/main';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const value: string[] = []; errors.set(page, value); page.on('pageerror', error => value.push(error.message)); });
test.afterEach(async ({ page }, info) => { await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' }); expect(errors.get(page)).toEqual([]); });
async function open(page: Page, path: '/dashboard' | '/achievements', query = '', width = 390) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1112 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${path}?populated&timerQuest&${query}`); await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect.poll(() => page.evaluate(() => window.readingSession.timer().isStarting)).toBe(false);
}
const state = (page: Page) => page.evaluate(() => window.readingSession.timer());
const session = (page: Page) => page.getByRole('region', { name: 'Active reading session', exact: true });
const start = (page: Page) => page.getByRole('button', { name: 'Start reading', exact: true });
async function choose(page: Page, book: 'The Left Hand of Darkness' | 'A Psalm for the Wild-Built' = 'A Psalm for the Wild-Built') {
  const picker = page.getByRole('dialog', { name: 'Start reading', exact: true }); await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: new RegExp(book) }).click();
}

test('Dashboard Daily Focus waits for timer permission and then starts the primary book', async ({ page }) => {
  await open(page, '/dashboard', 'runtime=android'); await page.evaluate(() => window.readingSession.device.configurePermission('defer'));
  await expect(start(page)).toBeEnabled(); await start(page).click();
  await expect.poll(() => page.evaluate(() => window.readingSession.device.snapshot().pendingPermissions)).toBe(1);
  await expect(session(page)).toHaveCount(0); await expect(page.getByText('Reading timer started', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Timer started for "The Left Hand of Darkness"', { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.readingSession.device.settlePermission(true));
  await expect(session(page)).toContainText('The Left Hand of Darkness'); expect(await state(page)).toMatchObject({ isRunning: true, bookId: 'book-1' });
  expect(await page.evaluate(() => window.readingSession.device.snapshot().requests)).toBe(1);
});

test('Dashboard streak Read now starts reading even when notifications are denied', async ({ page }) => {
  await open(page, '/dashboard', 'streakEntry&runtime=ios', 834); await page.evaluate(() => window.readingSession.device.configurePermission('denied'));
  await expect(page.locator('[data-streak-state="at_risk"]')).toBeVisible(); await page.getByRole('button', { name: 'Read now', exact: true }).click();
  await expect(session(page)).toContainText('The Left Hand of Darkness'); expect(await state(page)).toMatchObject({ isRunning: true, bookId: 'book-1' });
  expect(await page.evaluate(() => window.readingSession.device.snapshot().requests)).toBe(1);
});

test('Dashboard Daily Focus resumes its paused book without replacing elapsed time', async ({ page }) => {
  await open(page, '/dashboard', 'timer=paused'); const before = await state(page); await start(page).click();
  await expect.poll(async () => (await state(page)).isRunning).toBe(true);
  const after = await state(page); expect(after.clientSessionId).toBe(before.clientSessionId); expect(after.time).toBeGreaterThanOrEqual(before.time);
  expect(await page.evaluate(() => window.readingSession.device.snapshot().requests)).toBe(0);
  await expect(page.getByRole('dialog', { name: 'Replace this reading timer?', exact: true })).toHaveCount(0);
});

test('Journey overview quest picks an actual reading book and starts that book', async ({ page }) => {
  await open(page, '/achievements'); await expect(page.getByRole('heading', { name: 'Make time for a chapter', exact: true })).toBeVisible();
  await start(page).click(); await choose(page);
  await expect(session(page)).toContainText('A Psalm for the Wild-Built'); expect(await state(page)).toMatchObject({ isRunning: true, bookId: 'book-2' });
});

test('Journey Quests starts its only reading book without an unnecessary picker', async ({ page }) => {
  await open(page, '/achievements', 'tab=quests&oneBook', 834); await expect(page.getByRole('heading', { name: 'Your quests', exact: true })).toBeVisible();
  await start(page).click(); await expect(session(page)).toContainText('The Left Hand of Darkness');
  await expect(page.getByRole('dialog', { name: 'Start reading', exact: true })).toHaveCount(0); expect(await state(page)).toMatchObject({ bookId: 'book-1', isRunning: true });
});

test('Journey timer quest with no reading books opens the actual Library', async ({ page }) => {
  await open(page, '/achievements', 'tab=quests&emptyPicker'); await expect(start(page)).toBeEnabled(); await start(page).click();
  await expect(page).toHaveURL(/\/my-books(?:\?|$)/); await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quick actions', exact: true })).toBeVisible(); expect((await state(page)).isVisible).toBe(false);
});

test('Journey choosing another book respects Keep current in replacement confirmation', async ({ page }) => {
  await open(page, '/achievements', 'timer=paused'); const before = await state(page); await start(page).click(); await choose(page);
  const confirmation = page.getByRole('dialog', { name: 'Replace this reading timer?', exact: true }); await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Keep current', exact: true }).click(); await expect(confirmation).toHaveCount(0);
  expect(await state(page)).toMatchObject({ clientSessionId: before.clientSessionId, bookId: 'book-1', isRunning: false, time: before.time });
  expect(await page.evaluate(() => window.readingSession.device.snapshot().requests)).toBe(0);
});

test('Journey permission result cannot start the old reader book after account replacement', async ({ page }) => {
  await open(page, '/achievements', 'tab=quests&oneBook'); await page.evaluate(() => window.readingSession.device.configurePermission('defer'));
  await start(page).click(); await expect.poll(() => page.evaluate(() => window.readingSession.device.snapshot().pendingPermissions)).toBe(1);
  await page.evaluate(() => window.libraryTasks!.setAccount('another-reader')); await page.evaluate(() => window.readingSession.device.settlePermission(true));
  await expect.poll(async () => (await state(page)).isStarting).toBe(false); expect((await state(page)).isVisible).toBe(false);
  await expect(session(page)).toHaveCount(0); expect(await page.evaluate(() => window.readingSession.snapshot().outbox.length)).toBe(0);
});

async function openLibrary(page: Page) {
  await page.setViewportSize({ width: 834, height: 1112 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/my-books?populated'); await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect.poll(() => page.evaluate(() => window.readingSession.timer().isStarting)).toBe(false);
  await expect(page.getByRole('button', { name: 'More actions for The Left Hand of Darkness', exact: true })).toBeVisible();
}
const sharedPicker = (page: Page) => page.getByRole('dialog', { name: 'Start reading timer', exact: true });

test('shared picker keeps loading and read failure distinct from empty, then retries actual rows without writing', async ({ page }) => {
  await openLibrary(page); await page.evaluate(() => window.readingSession.configure('library', 'defer'));
  await page.getByRole('button', { name: 'Start reading timer', exact: true }).click(); await expect(sharedPicker(page)).toBeVisible();
  await expect(sharedPicker(page).locator('[data-loading-contract="timer-picker"]')).toBeVisible();
  await expect(sharedPicker(page).getByRole('heading', { name: 'No reading books', exact: true })).toHaveCount(0);
  await expect(sharedPicker(page).getByRole('button', { name: /The Left Hand of Darkness/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.readingSession.snapshot().pending.filter(call => call.operation === 'library').length)).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.readingSession.configure('library', 'reject');
    while (window.readingSession.snapshot().pending.some(call => call.operation === 'library')) window.readingSession.settle('library', 'reject');
  });
  await expect(sharedPicker(page).getByText('Reading books could not be refreshed.', { exact: true })).toBeVisible();
  await expect(sharedPicker(page).locator('[data-loading-contract="timer-picker"]')).toHaveCount(0);
  await expect(sharedPicker(page).getByRole('heading', { name: 'No reading books', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.readingSession.configure('library', 'resolve'));
  await sharedPicker(page).getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(sharedPicker(page).getByRole('button', { name: /The Left Hand of Darkness/ })).toBeVisible();
  await expect(sharedPicker(page).getByRole('button', { name: /A Psalm for the Wild-Built/ })).toBeVisible();
  await expect(sharedPicker(page).getByText('Reading books could not be refreshed.', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.readingSession.snapshot().outbox)).toHaveLength(0);
  expect(await page.evaluate(() => window.readingCapture.snapshot().outboxCounts)).toEqual({ books: 0, logs: 0 });
  expect((await state(page)).isVisible).toBe(false);
});

test('shared picker drops the former account list and ignores its pending permission after account replacement', async ({ page }) => {
  await openLibrary(page); await page.evaluate(() => {
    window.readingCapture.patchBook('book-1', { title: 'Private former-reader book' });
    window.readingSession.configure('library', 'defer');
  });
  await page.getByRole('button', { name: 'Start reading timer', exact: true }).click();
  await expect(sharedPicker(page).locator('[data-loading-contract="timer-picker"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.readingSession.snapshot().pending.filter(call => call.operation === 'library').length)).toBeGreaterThan(0);
  await page.evaluate(() => { window.readingSession.configure('library', 'resolve'); window.libraryTasks!.setAccount('second-reader'); });
  await expect(sharedPicker(page)).toHaveCount(0);
  await page.evaluate(() => {
    while (window.readingSession.snapshot().pending.some(call => call.operation === 'library')) window.readingSession.settle('library', 'resolve');
  });
  await expect.poll(async () => (await state(page)).isStarting).toBe(false);
  await page.getByRole('button', { name: 'Start reading timer', exact: true }).click();
  await expect(sharedPicker(page).getByRole('button', { name: /The Left Hand of Darkness/ })).toBeVisible();
  await expect(sharedPicker(page).getByText('Private former-reader book', { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.readingSession.device.configurePermission('defer'));
  await sharedPicker(page).getByRole('button', { name: /The Left Hand of Darkness/ }).click();
  await expect.poll(() => page.evaluate(() => window.readingSession.device.snapshot().pendingPermissions)).toBe(1);
  await page.evaluate(() => window.libraryTasks!.setAccount('third-reader')); await expect(sharedPicker(page)).toHaveCount(0);
  await page.evaluate(() => window.readingSession.device.settlePermission(true));
  await expect.poll(async () => (await state(page)).isStarting).toBe(false);
  expect((await state(page)).isVisible).toBe(false); await expect(session(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.readingSession.snapshot().outbox)).toHaveLength(0);
});
