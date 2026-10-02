import { expect, test, type Page } from '@playwright/test';
import type {} from '../fixtures/reading-session/main';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const list: string[] = []; errors.set(page, list); page.on('pageerror', error => list.push(error.message)); });
test.afterEach(async ({ page }, info) => { await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' }); expect(errors.get(page)).toEqual([]); });
const state = (page: Page) => page.evaluate(() => window.readingSession.snapshot());
const timer = (page: Page) => page.evaluate(() => window.readingSession.timer());
const details = (page: Page) => page.getByRole('dialog', { name: 'Reading session', exact: true });
const review = (page: Page) => page.getByRole('dialog', { name: 'Finish reading', exact: true });
const picker = (page: Page) => page.getByRole('dialog', { name: 'Start reading timer', exact: true });
async function open(page: Page, route = '/book/book-1', query = 'timer=paused', width = 390, height = 844) {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${route}?populated&${query}`); await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect.poll(async () => (await timer(page)).isStarting).toBe(false);
}
async function finishReview(page: Page) {
  await page.getByRole('button', { name: 'Open timer details', exact: true }).click();
  await details(page).getByRole('button', { name: 'Finish session', exact: true }).click(); await expect(review(page)).toBeVisible();
}
async function reload(page: Page) {
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect.poll(async () => (await timer(page)).isStarting).toBe(false);
}
async function openPicker(page: Page, width = 390, query = '') {
  await open(page, '/my-books', query, width, width === 390 ? 844 : 1112);
  if (width < 768) { await page.getByRole('button', { name: 'Quick actions', exact: true }).click(); await page.getByRole('dialog', { name: 'Quick actions', exact: true }).getByRole('button', { name: 'Start Reading Timer', exact: true }).click(); }
  else await page.getByRole('button', { name: 'Start reading timer', exact: true }).click();
  await expect(picker(page)).toBeVisible();
}
async function fonts(page: Page) {
  expect(await page.evaluate(async () => {
    const families = ['Inter', 'Merriweather', 'Playfair Display'];
    await Promise.all(families.map(f => document.fonts.load(`16px "${f}"`))); await document.fonts.ready;
    return families.every(f => [...document.fonts].some(face => face.family.replace(/["']/g, '') === f && face.status === 'loaded'));
  })).toBe(true);
}
const profiles = [
  { name: 'phone', width: 390, height: 844, query: '' }, { name: 'tablet', width: 834, height: 1112, query: '' },
  { name: 'desktop', width: 1440, height: 1000, query: '' }, { name: 'compact200', width: 320, height: 900, query: 'text=200&long' },
  { name: 'tablet200', width: 834, height: 1112, query: 'text=200&long' }, { name: 'landscape', width: 844, height: 390, query: '' },
  { name: 'dark', width: 834, height: 1112, query: 'theme=dark' }, { name: 'paper', width: 390, height: 844, query: 'palette=paper-library' },
  { name: 'android', width: 390, height: 844, query: 'runtime=android' }, { name: 'ios', width: 834, height: 1112, query: 'runtime=ios' },
];
for (const profile of profiles) test(`session composition ${profile.name}`, async ({ page }, info) => {
  await open(page, '/book/book-1', `timer=paused&${profile.query}`, profile.width, profile.height); await fonts(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Open timer details', exact: true }).click();
  await expect(details(page)).toBeVisible(); await info.attach('session', { body: await page.screenshot(), contentType: 'image/png' });
  await details(page).getByRole('button', { name: 'Finish session', exact: true }).click();
  await expect(review(page)).toContainText('13 minutes');
  expect(await review(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  for (const button of await review(page).getByRole('button').all()) {
    await button.scrollIntoViewIfNeeded(); const rect = (await button.boundingBox())!;
    expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.x).toBeGreaterThanOrEqual(-1); expect(rect.x + rect.width).toBeLessThanOrEqual(profile.width + 1);
  }
  await info.attach('finish-review', { body: await page.screenshot(), contentType: 'image/png' });
  await review(page).getByRole('button', { name: 'Save session', exact: true }).scrollIntoViewIfNeeded();
  if (profile.name === 'compact200' || profile.name === 'landscape') await info.attach('finish-actions', { body: await page.screenshot(), contentType: 'image/png' });
  await review(page).getByRole('button', { name: 'Back to session' }).click();
  await details(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open timer details', exact: true })).toBeFocused(); expect((await state(page)).outbox).toHaveLength(0);
});

for (const width of [390, 834, 1440]) test(`real picker entry ${width} starts selected book and survives resize`, async ({ page }, info) => {
  await openPicker(page, width); await fonts(page); const original = await picker(page).elementHandle();
  await info.attach('picker', { body: await page.screenshot(), contentType: 'image/png' });
  await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 900 });
  expect(await picker(page).evaluate((node, first) => node === first, original)).toBe(true);
  const row = picker(page).getByRole('button', { name: /The Left Hand of Darkness/ });
  await row.click(); await expect(picker(page)).toHaveCount(0);
  await expect.poll(async () => (await timer(page)).bookId).toBe('book-1');
  expect((await timer(page)).isRunning).toBe(true); expect((await state(page)).outbox).toHaveLength(0);
});

test('picker empty state has real Library and Add Book routes', async ({ page }) => {
  await openPicker(page, 390, 'emptyPicker'); await expect(picker(page).getByRole('heading', { name: 'No reading books' })).toBeVisible();
  await picker(page).getByRole('button', { name: 'Library', exact: true }).click(); await expect(picker(page)).toHaveCount(0); await expect(page).toHaveURL(/\/my-books$/);
  await openPicker(page, 834, 'emptyPicker'); await picker(page).getByRole('button', { name: 'Add Book', exact: true }).click(); await expect(page).toHaveURL(/\/add-book$/);
});

test('book entry permission delay rejects duplicates and late account outcome', async ({ page }) => {
  await open(page, '/book/book-1', 'runtime=android'); await page.evaluate(() => window.readingSession.device.configurePermission('defer'));
  await page.getByRole('button', { name: 'Start reading', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.readingSession.device.snapshot().pendingPermissions)).toBe(1);
  await page.evaluate(() => window.libraryTasks!.setAccount('another-reader'));
  await page.evaluate(() => window.readingSession.device.settlePermission(true));
  await expect.poll(async () => (await timer(page)).isStarting).toBe(false);
  expect((await timer(page)).isVisible).toBe(false); expect((await state(page)).outbox).toHaveLength(0);
  await expect(page.getByText(/Timer started for/)).toHaveCount(0);
});

test('permission denial still starts an owned timer and elapsed time survives background and reload', async ({ page }) => {
  await page.clock.install(); await open(page, '/book/book-1', 'runtime=android');
  await page.evaluate(() => window.readingSession.device.configurePermission('denied'));
  await page.getByRole('button', { name: 'Start reading', exact: true }).click(); await expect.poll(async () => (await timer(page)).isRunning).toBe(true);
  const id = (await timer(page)).clientSessionId; await page.evaluate(() => window.readingSession.device.appState(false));
  await page.clock.fastForward(65_000); await page.evaluate(() => window.readingSession.device.appState(true));
  await expect.poll(async () => (await timer(page)).time).toBeGreaterThanOrEqual(65);
  await page.getByRole('button', { name: 'Pause reading', exact: true }).click(); const paused = (await timer(page)).time;
  await page.clock.fastForward(120_000); expect((await timer(page)).time).toBe(paused);
  await reload(page); await expect.poll(async () => (await timer(page)).clientSessionId).toBe(id); expect((await timer(page)).time).toBe(paused);
  expect((await timer(page)).isRunning).toBe(false);
});

test('review pauses without saving and permits deliberate return to reading', async ({ page }) => {
  await open(page, '/book/book-1', 'timer=running'); await finishReview(page);
  expect((await timer(page)).isRunning).toBe(false); expect((await state(page)).sessions).toHaveLength(0);
  await review(page).getByRole('button', { name: 'Back to session' }).click(); await details(page).getByRole('button', { name: 'Resume', exact: true }).click();
  expect((await timer(page)).isRunning).toBe(true); await page.keyboard.press('Escape'); await expect(details(page)).toHaveCount(0);
  expect((await timer(page)).isVisible).toBe(true);
});

test('save pending locks native Back Escape duplicate stop and keeps actual task through route replacement', async ({ page }) => {
  await open(page, '/book/book-1', 'timer=paused&runtime=android');
  await page.evaluate(() => window.readingSession.configure('session', 'defer')); await finishReview(page);
  const original = await review(page).elementHandle(); await review(page).getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(review(page)).toHaveAttribute('aria-busy', 'true'); await page.keyboard.press('Escape'); await page.evaluate(() => window.libraryTasks!.back());
  await page.evaluate(() => { window.readingSession.device.stop(); window.libraryTasks!.navigate('/my-books'); });
  expect(await review(page).evaluate((node, first) => node === first, original)).toBe(true);
  expect((await state(page)).calls.filter(call => call.operation === 'session')).toHaveLength(1);
  await page.evaluate(() => window.readingSession.settle('session', 'resolve')); await expect(review(page)).toHaveCount(0);
  expect((await state(page)).outbox).toHaveLength(1); expect((await timer(page)).isVisible).toBe(false);
  const journal = page.getByRole('dialog', { name: 'Add Journal Entry', exact: true }); await expect(journal).toBeVisible();
  await expect(journal).toContainText('13 min read'); expect(await journal.evaluate(node => node.contains(document.activeElement))).toBe(true);
});

test('session failure retains exact paused payload and retry produces one local record', async ({ page }) => {
  await open(page); await page.evaluate(() => window.readingSession.configure('session', 'reject')); await finishReview(page);
  await review(page).getByRole('button', { name: 'Save session', exact: true }).click(); await expect(review(page).getByRole('alert')).toBeVisible();
  expect((await timer(page)).isRunning).toBe(false); const first = (await state(page)).calls.find(call => call.operation === 'session')!.payload;
  await page.evaluate(() => window.readingSession.configure('session', 'resolve')); await review(page).getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(review(page)).toHaveCount(0); const snapshot = await state(page);
  expect(snapshot.outbox).toHaveLength(1); expect(snapshot.calls.filter(call => call.operation === 'session')[1].payload).toEqual(first);
});

test('committed session response failure is verified without a duplicate outbox mutation', async ({ page }) => {
  await open(page); await page.evaluate(() => window.readingSession.configure('session', 'commit-reject')); await finishReview(page);
  await review(page).getByRole('button', { name: 'Save session', exact: true }).click(); await expect(review(page)).toHaveCount(0);
  expect((await state(page)).outbox).toHaveLength(1); expect((await timer(page)).isVisible).toBe(false);
});

test('session completion advances actual stored Library recency without changing the saved page', async ({ page }) => {
  await open(page); await page.evaluate(() => window.readingCapture.patchBook('book-1', { updated_at: '2020-01-01T00:00:00Z' }));
  await finishReview(page); await review(page).getByRole('button', { name: 'Save session', exact: true }).click(); await expect(review(page)).toHaveCount(0);
  const session = (await state(page)).outbox[0].session;
  const local = await page.evaluate(() => window.readingCapture.snapshot());
  expect(local.books.find(book => book.id === 'book-1')).toMatchObject({ updated_at: session.created_at, current_page: 42 });
  expect(local.outboxCounts.books).toBe(1); expect(local.outboxCounts.logs).toBe(0);
});

test('book-stage failure persists frozen completion through reload without repeating saved time', async ({ page }) => {
  await open(page); await page.evaluate(() => { window.readingCapture.patchBook('book-1', { status: 'to_read', date_started: null }); window.readingCapture.configure('book', 'reject'); });
  await finishReview(page); await review(page).getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(review(page).getByRole('alert')).toContainText('Your reading time is saved on this device');
  const first = (await state(page)).outbox[0].session; expect((await state(page)).outbox).toHaveLength(1);
  await reload(page); await expect.poll(async () => (await timer(page)).saveFrozen).toBe(true);
  await page.getByRole('button', { name: 'Open timer details', exact: true }).click(); await expect(review(page)).toBeVisible();
  await review(page).getByRole('button', { name: 'Retry save', exact: true }).click(); await expect(review(page)).toHaveCount(0);
  expect((await state(page)).outbox).toHaveLength(1); expect((await state(page)).outbox[0].session).toEqual(first);
});

test('native stop validates session identity and never opens a journal', async ({ page }) => {
  await open(page, '/book/book-1', 'timer=paused&runtime=android');
  await page.evaluate(() => { window.readingSession.device.stop(null); window.readingSession.device.stop({ userId: 'another-reader', clientSessionId: 'fixture-session-1' }); window.readingSession.device.stop({ userId: 'shell-reader', clientSessionId: 'old-session' }); });
  expect((await state(page)).outbox).toHaveLength(0); expect((await timer(page)).isVisible).toBe(true);
  await page.evaluate(() => window.readingSession.device.stop({ userId: 'shell-reader', clientSessionId: 'fixture-session-1' }));
  await expect.poll(async () => (await timer(page)).isVisible).toBe(false); expect((await state(page)).outbox).toHaveLength(1);
  await expect(page.getByRole('dialog', { name: 'Add Journal Entry' })).toHaveCount(0);
});

test('account switch hides and pauses the first reader without losing their timer', async ({ page }) => {
  await open(page, '/book/book-1', 'timer=running'); const id = (await timer(page)).clientSessionId;
  await page.evaluate(() => window.libraryTasks!.setAccount('another-reader')); await expect(page.getByRole('region', { name: 'Active reading session' })).toHaveCount(0);
  await page.evaluate(() => window.libraryTasks!.setAccount('shell-reader')); await expect.poll(async () => (await timer(page)).clientSessionId).toBe(id);
  expect((await timer(page)).isRunning).toBe(false); expect((await state(page)).outbox).toHaveLength(0);
});

test('owned legacy timer migrates without accepting another readers record', async ({ page }) => {
  await open(page, '/book/book-1', 'timer=paused&legacyTimer'); await expect.poll(async () => (await timer(page)).isVisible).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('readingTimer'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('readingTimer:shell-reader'))).not.toBeNull();
  await page.evaluate(() => window.libraryTasks!.setAccount(null)); await expect.poll(async () => (await timer(page)).isVisible).toBe(false);
  await page.evaluate(() => { localStorage.removeItem('readingTimer:shell-reader'); sessionStorage.clear(); });
  await open(page, '/book/book-1', 'timer=paused&legacyTimer&timerOwner=another-reader'); expect((await timer(page)).isVisible).toBe(false);
});

test('recovery validates raw minutes and blocks pending Back before one reviewed save', async ({ page }, info) => {
  await open(page, '/book/book-1', 'timer=stale&runtime=android'); await fonts(page);
  const recovery = page.getByRole('dialog', { name: 'Review old timer' }); const minutes = recovery.getByLabel('Minutes actually read');
  for (const value of ['', '0', '-1', '2.5', '2e2', '721', '9007199254740992']) {
    await minutes.fill(value); await recovery.getByRole('button', { name: 'Save reviewed time' }).click();
    await expect(minutes).toHaveAttribute('aria-invalid', 'true'); await expect(minutes).toBeFocused();
  }
  expect((await state(page)).outbox).toHaveLength(0); await minutes.fill('27');
  const original = await minutes.elementHandle(); await page.setViewportSize({ width: 834, height: 1112 });
  expect(await minutes.evaluate((node, first) => node === first, original)).toBe(true); await expect(minutes).toHaveValue('27');
  await info.attach('recovery', { body: await page.screenshot(), contentType: 'image/png' });
  await page.evaluate(() => window.readingSession.configure('session', 'defer')); await recovery.getByRole('button', { name: 'Save reviewed time' }).click();
  await page.keyboard.press('Escape'); await page.evaluate(() => window.libraryTasks!.back()); await expect(recovery).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => window.readingSession.settle('session', 'resolve')); await expect(recovery).toHaveCount(0);
  expect((await state(page)).outbox[0].session.duration).toBe(27);
});

test('discard recovery needs explicit confirmation and no reading record is created', async ({ page }) => {
  await open(page, '/book/book-1', 'timer=stale'); const recovery = page.getByRole('dialog', { name: 'Review old timer' });
  await recovery.getByLabel('Minutes actually read').fill('44'); await page.keyboard.press('Escape');
  const confirm = page.getByRole('dialog', { name: 'Discard this timer?' }); await expect(confirm.getByRole('button', { name: 'Keep reviewing' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Keep reviewing' }).click(); await expect(recovery.getByLabel('Minutes actually read')).toHaveValue('44');
  await recovery.getByRole('button', { name: 'Discard timer', exact: true }).click(); await confirm.getByRole('button', { name: 'Discard timer', exact: true }).click();
  await expect(recovery).toHaveCount(0); expect((await state(page)).outbox).toHaveLength(0);
});

test('cancel active session protects recorded time until explicit discard', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Open timer details' }).click(); await details(page).getByRole('button', { name: 'Cancel session' }).click();
  const confirm = page.getByRole('dialog', { name: 'Discard this reading session?' }); await expect(confirm.getByRole('button', { name: 'Keep timer' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Keep timer' }).click(); await expect(details(page)).toBeVisible(); expect((await timer(page)).isVisible).toBe(true);
  await details(page).getByRole('button', { name: 'Cancel session' }).click(); await confirm.getByRole('button', { name: 'Discard session' }).click();
  await expect(details(page)).toHaveCount(0); expect((await timer(page)).isVisible).toBe(false); expect((await state(page)).outbox).toHaveLength(0);
});

test('choosing the active paused book in Quick actions resumes it and closes the picker', async ({ page }) => {
  await open(page, '/my-books', 'timer=paused');
  await page.getByRole('button', { name: 'Quick actions', exact: true }).click();
  await page.getByRole('dialog', { name: 'Quick actions', exact: true }).getByRole('button', { name: 'Start Reading Timer', exact: true }).click();
  await picker(page).getByRole('button', { name: /The Left Hand of Darkness/ }).click();
  await expect(picker(page)).toHaveCount(0); expect((await timer(page)).isRunning).toBe(true);
  expect((await timer(page)).clientSessionId).toBe('fixture-session-1'); expect((await state(page)).outbox).toHaveLength(0);
});

test('another-book selection retains the current timer unless replacement is confirmed', async ({ page }) => {
  await open(page, '/my-books', 'timer=paused');
  await page.getByRole('button', { name: 'Quick actions', exact: true }).click();
  await page.getByRole('dialog', { name: 'Quick actions', exact: true }).getByRole('button', { name: 'Start Reading Timer', exact: true }).click();
  await picker(page).getByRole('button', { name: /A Psalm for the Wild-Built/ }).click();
  const confirm = page.getByRole('dialog', { name: 'Replace this reading timer?' });
  await expect(confirm.getByRole('button', { name: 'Keep current' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Keep current' }).click();
  await expect(picker(page)).toBeVisible(); expect((await timer(page)).clientSessionId).toBe('fixture-session-1');
  await picker(page).getByRole('button', { name: /A Psalm for the Wild-Built/ }).click(); await confirm.getByRole('button', { name: 'Start new timer' }).click();
  await expect(picker(page)).toHaveCount(0); expect((await timer(page)).bookId).toBe('book-2'); expect((await timer(page)).clientSessionId).not.toBe('fixture-session-1');
  expect((await state(page)).outbox).toHaveLength(0);
});

test('departing reader pending save cannot lock or close the next reader session', async ({ page }) => {
  await open(page); await page.evaluate(() => window.readingSession.configure('session', 'defer')); await finishReview(page);
  await review(page).getByRole('button', { name: 'Save session', exact: true }).click(); await expect(review(page)).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => window.libraryTasks!.setAccount('another-reader')); await expect(review(page)).toHaveCount(0);
  await expect.poll(async () => (await timer(page)).isStarting).toBe(false);
  await page.getByRole('button', { name: 'Start reading', exact: true }).click(); await expect.poll(async () => (await timer(page)).isRunning).toBe(true);
  const nextId = (await timer(page)).clientSessionId;
  await page.getByRole('button', { name: 'Open timer details' }).click(); await expect(details(page).getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
  await page.evaluate(() => window.readingSession.settle('session', 'resolve'));
  await expect(details(page)).toBeVisible(); expect((await timer(page)).clientSessionId).toBe(nextId); expect((await timer(page)).isSaving).toBe(false);
  await expect(page.getByRole('dialog', { name: 'Add Journal Entry' })).toHaveCount(0);
});

test('saved session journal can be skipped and restores focus to visible page content', async ({ page }) => {
  await open(page); await finishReview(page); await review(page).getByRole('button', { name: 'Save session', exact: true }).click();
  const journal = page.getByRole('dialog', { name: 'Add Journal Entry', exact: true }); await expect(journal).toBeVisible();
  await journal.getByRole('button', { name: 'Skip', exact: true }).click(); await expect(journal).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.activeElement !== document.body && document.activeElement?.isConnected)).toBe(true);
  expect((await state(page)).outbox).toHaveLength(1); expect((await state(page)).journals).toHaveLength(0);
});

test('partial recovery reload focuses an enabled retry and verifies the saved time once', async ({ page }) => {
  await open(page, '/book/book-1', 'timer=stale');
  await page.evaluate(() => { window.readingCapture.patchBook('book-1', { status: 'to_read', date_started: null }); window.readingCapture.configure('book', 'reject'); });
  const recovery = page.getByRole('dialog', { name: 'Review old timer', exact: true });
  await recovery.getByLabel('Minutes actually read').fill('23'); await recovery.getByRole('button', { name: 'Save reviewed time' }).click();
  await expect(recovery.getByRole('alert')).toContainText('Your reading time is saved on this device');
  await reload(page); await expect(recovery.getByRole('button', { name: 'Retry save' })).toBeFocused();
  await expect(recovery.getByLabel('Minutes actually read')).toBeDisabled(); await expect(recovery.getByLabel('Minutes actually read')).toHaveValue('23');
  await recovery.getByRole('button', { name: 'Retry save' }).click(); await expect(recovery).toHaveCount(0);
  expect((await state(page)).outbox).toHaveLength(1); expect((await state(page)).outbox[0].session.duration).toBe(23);
});

test.describe('touch tablet', () => {
  test.use({ hasTouch: true });
  test('session and picker use one retained sheet without preventing browser pinch', async ({ page }, info) => {
    await openPicker(page, 834); await expect(picker(page)).toHaveAttribute('data-presentation', 'sheet');
    expect(await picker(page).evaluate(node => getComputedStyle(node).touchAction)).toContain('pinch-zoom');
    await fonts(page); await info.attach('touch-tablet-picker', { body: await page.screenshot(), contentType: 'image/png' });
    await picker(page).getByRole('button', { name: /The Left Hand of Darkness/ }).click();
    await page.getByRole('button', { name: 'Open timer details' }).click(); await expect(details(page)).toHaveAttribute('data-presentation', 'sheet');
    await page.keyboard.press('Tab'); expect(await details(page).evaluate(node => node.contains(document.activeElement))).toBe(true);
    await info.attach('touch-tablet-session', { body: await page.screenshot(), contentType: 'image/png' });
  });
});
