import { expect, test, type Page } from '@playwright/test';
import type {} from '../fixtures/reading-progress/main';
import type { CaptureMode, CaptureOperation } from '../fixtures/reading-progress/api';
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const errors: string[] = []; pageErrors.set(page, errors); page.on('pageerror', error => errors.push(error.message)); });
test.afterEach(async ({ page }, info) => {
  await info.attach('page-errors', { body: JSON.stringify(pageErrors.get(page)), contentType: 'application/json' });
  expect(pageErrors.get(page)).toEqual([]);
});
const snapshot = (page: Page) => page.evaluate(() => window.readingCapture.snapshot());
const configure = (page: Page, operation: CaptureOperation, mode: CaptureMode) => page.evaluate(({ operation, mode }) => window.readingCapture.configure(operation, mode), { operation, mode });
const settle = (page: Page, operation: CaptureOperation, outcome: 'resolve' | 'reject' | 'cancel') => page.evaluate(({ operation, outcome }) => window.readingCapture.settle(operation, outcome), { operation, outcome });
const logger = (page: Page) => page.getByRole('dialog', { name: 'Log reading progress', exact: true });
async function open(page: Page, entry: 'book' | 'route' | 'dashboard' = 'book', query = '', width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${entry === 'route' ? '/book/book-1/progress' : entry === 'dashboard' ? '/dashboard' : '/book/book-1'}?populated&${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(page.getByRole('button', { name: 'Log progress', exact: true }).first()).toBeVisible();
}
async function log(page: Page, entry: 'book' | 'route' | 'dashboard' = 'book', query = '') {
  await open(page, entry, query);
  await page.getByRole('button', { name: 'Log progress', exact: true }).first().click();
  await expect(logger(page)).toBeVisible();
}
async function fonts(page: Page) {
  expect(await page.evaluate(async () => {
    const families = ['Inter', 'Merriweather', 'Playfair Display'];
    await Promise.all(families.map(f => document.fonts.load(`16px "${f}"`))); await document.fonts.ready;
    return families.every(f => [...document.fonts].some(face => face.family.replace(/["']/g, '') === f && face.status === 'loaded'));
  })).toBe(true);
}
const profiles = [
  { name: 'phone', width: 390, height: 844, query: '' },
  { name: 'tablet', width: 834, height: 1112, query: '' },
  { name: 'desktop', width: 1440, height: 1000, query: '' },
  { name: 'compact200', width: 320, height: 900, query: 'text=200&long' },
  { name: 'tablet200', width: 834, height: 1112, query: 'text=200&long' },
  { name: 'landscape', width: 844, height: 390, query: '' },
  { name: 'dark', width: 834, height: 1112, query: 'theme=dark' },
  { name: 'paper', width: 390, height: 844, query: 'palette=paper-library' },
  { name: 'android', width: 390, height: 844, query: 'runtime=android' },
  { name: 'ios', width: 834, height: 1112, query: 'runtime=ios' },
];
for (const profile of profiles) test(`composition ${profile.name}`, async ({ page }, info) => {
  await open(page, 'route', profile.query, profile.width, profile.height); await fonts(page);
  await expect(page.getByRole('heading', { name: 'Reading activity', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Daily reading activity' })).toBeVisible();
  await expect(page.locator('.apexcharts-canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const action = page.getByRole('button', { name: 'Log progress', exact: true });
  await action.scrollIntoViewIfNeeded(); const bounds = (await action.boundingBox())!;
  expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.width).toBeGreaterThanOrEqual(44);
  if (profile.name === 'phone' || profile.name === 'android') expect(bounds.y + bounds.height).toBeLessThan(profile.height - 80);
  await info.attach('route', { body: await page.screenshot(), contentType: 'image/png' });
  await action.click(); await expect(logger(page).getByLabel('Page reached')).toBeFocused();
  await expect(logger(page).getByLabel('Reading notes')).not.toBeVisible();
  const save = logger(page).getByRole('button', { name: 'Save progress', exact: true }); await save.scrollIntoViewIfNeeded();
  expect(await logger(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await info.attach('capture', { body: await page.screenshot(), contentType: 'image/png' });
  await logger(page).locator('summary').click();
  await logger(page).getByLabel('Reading notes').fill('A passage worth returning to.');
  await logger(page).getByRole('button', { name: 'Attach photo' }).scrollIntoViewIfNeeded();
  await info.attach('optional-fields', { body: await page.screenshot(), contentType: 'image/png' });
  expect(await logger(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  for (const control of await logger(page).locator('button:visible,input:visible,textarea:visible,summary:visible').all()) {
    await control.scrollIntoViewIfNeeded(); const rect = (await control.boundingBox())!;
    expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.x).toBeGreaterThanOrEqual(-1); expect(rect.x + rect.width).toBeLessThanOrEqual(profile.width + 1);
  }
});

for (const entry of ['book', 'dashboard', 'route'] as const) test(`save from ${entry} retains local page through stale refresh and reopens fresh`, async ({ page }) => {
  await log(page, entry); const trigger = page.getByRole('button', { name: 'Log progress', exact: true }).first();
  await logger(page).getByLabel('Page reached').fill('65');
  await logger(page).locator('summary').click(); await logger(page).getByLabel('Reading notes').fill('Saved locally');
  await logger(page).getByLabel('Minutes read').fill('25');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(logger(page)).toHaveCount(0); await expect(trigger).toBeFocused();
  await expect.poll(async () => (await snapshot(page)).books.find(book => book.id === 'book-1')?.current_page).toBe(65);
  const state = await snapshot(page); expect(state.outboxCounts).toEqual({ books: 1, logs: 1 });
  expect(state.logs.find(item => item.page_number === 65)).toMatchObject({ notes: 'Saved locally', time_spent_minutes: 25 });
  await trigger.click(); await expect(logger(page).getByLabel('Page reached')).toHaveValue('65');
  await logger(page).locator('summary').click(); await expect(logger(page).getByLabel('Reading notes')).toHaveValue('');
});

test('strict validation associates errors, focuses fields, and creates no writes', async ({ page }) => {
  await log(page); const input = logger(page).getByLabel('Page reached');
  for (const value of ['', '0', '-1', '3.5', '2e2', '301', '9007199254740992']) {
    await input.fill(value); await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click();
    await expect(input).toHaveAttribute('aria-invalid', 'true'); await expect(input).toBeFocused();
    await expect(input).toHaveAccessibleDescription(/Enter a whole page number from 1 to 300/);
  }
  await input.fill('90'); await logger(page).locator('summary').click(); await logger(page).getByLabel('Minutes read').fill('2.5');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(logger(page).getByLabel('Minutes read')).toBeFocused();
  expect((await snapshot(page)).outbox).toHaveLength(0);
});
test('dirty Back guards, retained task across resize, discard clears and restores invoker', async ({ page }) => {
  await log(page, 'book', 'runtime=android'); await logger(page).locator('summary').click();
  const notes = logger(page).getByLabel('Reading notes'); await notes.fill('Keep this draft'); const original = await notes.elementHandle();
  for (const width of [834, 1440, 320, 390]) {
    await page.setViewportSize({ width, height: 900 }); await expect(notes).toHaveValue('Keep this draft');
    expect(await notes.evaluate((node, first) => node === first, original)).toBe(true);
  }
  await page.evaluate(() => window.libraryTasks!.back());
  const confirm = page.getByRole('dialog', { name: 'Discard this progress draft?' });
  await expect(confirm.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(confirm).toHaveCount(0); await expect(notes).toHaveValue('Keep this draft');
  await logger(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await confirm.getByRole('button', { name: 'Discard draft' }).click(); await expect(logger(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Log progress', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Log progress', exact: true }).click(); await logger(page).locator('summary').click(); await expect(notes).toHaveValue('');
});
test('pending capture vetoes Escape Back and repeated submission', async ({ page }) => {
  await log(page, 'book', 'runtime=android'); await configure(page, 'log', 'defer');
  await logger(page).getByLabel('Page reached').fill('70'); await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(logger(page).getByRole('button', { name: 'Saving progress...' })).toBeDisabled();
  await page.keyboard.press('Escape'); await page.evaluate(() => window.libraryTasks!.back());
  await logger(page).locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
  expect((await snapshot(page)).calls.filter(call => call.operation === 'log')).toHaveLength(1);
  await expect(logger(page)).toBeVisible(); await settle(page, 'log', 'resolve'); await expect(logger(page)).toHaveCount(0);
  expect((await snapshot(page)).outboxCounts).toEqual({ books: 1, logs: 1 });
});
test('failed initial capture keeps editable draft and retries once', async ({ page }) => {
  await log(page); await configure(page, 'log', 'reject'); await logger(page).getByLabel('Page reached').fill('77');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(logger(page).getByRole('alert')).toContainText('Fixture log failed');
  await expect(logger(page).getByLabel('Page reached')).toBeEnabled(); expect((await snapshot(page)).outboxCounts.logs).toBe(0);
  await configure(page, 'log', 'resolve'); await logger(page).getByLabel('Page reached').fill('78');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click(); await expect(logger(page)).toHaveCount(0);
  expect((await snapshot(page)).outboxCounts).toEqual({ books: 1, logs: 1 });
});
test('partial book failure retries frozen submitted log without duplicating activity', async ({ page }) => {
  await log(page); await configure(page, 'book', 'reject'); await logger(page).getByLabel('Page reached').fill('80');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(logger(page).getByRole('alert')).toContainText('Your reading log is saved on this device');
  await expect(logger(page).getByLabel('Page reached')).toBeDisabled(); expect((await snapshot(page)).outboxCounts).toEqual({ books: 0, logs: 1 });
  await logger(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog', { name: 'Close this save?' }).getByRole('button', { name: 'Keep task open' }).click();
  await configure(page, 'book', 'resolve'); await logger(page).getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(logger(page)).toHaveCount(0); const state = await snapshot(page);
  expect(state.outboxCounts).toEqual({ books: 1, logs: 1 }); expect(state.calls.filter(call => call.operation === 'log')).toHaveLength(1);
});
test('ambiguous committed capture response is recognized without repeating log creation', async ({ page }) => {
  await log(page); await configure(page, 'log', 'commit-reject'); await logger(page).getByLabel('Page reached').fill('81');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click(); await expect(logger(page)).toHaveCount(0);
  expect((await snapshot(page)).outboxCounts).toEqual({ books: 1, logs: 1 });
});
test('account change during capture cannot update the next reader or retain draft', async ({ page }) => {
  await log(page, 'dashboard'); await configure(page, 'log', 'defer'); await logger(page).getByLabel('Page reached').fill('82');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).pending.filter(call => call.operation === 'log').length).toBe(1);
  await page.evaluate(() => window.libraryTasks!.setAccount('reader-b')); await expect(logger(page)).toHaveCount(0);
  await settle(page, 'log', 'resolve'); await expect.poll(async () => (await snapshot(page)).outboxCounts.logs).toBe(1);
  const state = await snapshot(page); expect(state.outboxCounts.books).toBe(0); expect(state.outbox[0].owner).toBe('shell-reader');
  await page.getByRole('button', { name: 'Log progress', exact: true }).first().click(); await expect(logger(page).getByLabel('Page reached')).toHaveValue('42');
});
test('offline progress route captures locally without inventing synced history', async ({ page }) => {
  await log(page, 'route', 'offline'); await logger(page).getByLabel('Page reached').fill('83');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click(); await expect(logger(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Your place in this book' })).toContainText('Page 83');
  await expect(page.locator('.progress-route-notice')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Daily reading activity' })).toHaveCount(0);
  const state = await snapshot(page); expect(state.outboxCounts).toEqual({ books: 1, logs: 1 }); expect(state.syncRequests).toHaveLength(0);
  expect(state.calls.filter(call => ['history', 'metrics'].includes(call.operation))).toHaveLength(0);
});
test('lower-page log preserves saved place and finishing page has an explicit consequence', async ({ page }) => {
  await log(page); await logger(page).getByLabel('Page reached').fill('30'); await expect(logger(page)).toContainText('keeps your saved place at page 42');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click(); await expect(logger(page)).toHaveCount(0);
  expect((await snapshot(page)).books.find(book => book.id === 'book-1')?.current_page).toBe(42);
  await page.getByRole('button', { name: 'Log progress', exact: true }).click(); await logger(page).getByLabel('Page reached').fill('300');
  await expect(logger(page)).toContainText('also marks the book finished');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click(); await expect(logger(page)).toHaveCount(0);
  expect((await snapshot(page)).books.find(book => book.id === 'book-1')).toMatchObject({ current_page: 300, status: 'completed' });
});
test('unknown total supports capture without a fabricated maximum or percentage', async ({ page }) => {
  await log(page, 'route', 'unknown'); await expect(logger(page)).toContainText("Total pages aren't set");
  await logger(page).getByLabel('Page reached').fill('501'); await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click(); await expect(logger(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Your place in this book' })).toContainText('Page 501'); await expect(page.locator('progress')).toHaveCount(0);
});
test('captured local log remains in Book Detail after older history refresh', async ({ page }) => {
  await log(page); await logger(page).getByLabel('Page reached').fill('84'); await logger(page).locator('summary').click();
  await logger(page).getByLabel('Reading notes').fill('Visible before server acknowledgement'); await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(logger(page)).toHaveCount(0); await page.getByRole('tab', { name: 'Logs', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Logs' })).toContainText('Visible before server acknowledgement');
});
test('attachment rejection retains selection, retry succeeds, pending cannot dismiss', async ({ page }) => {
  await log(page); await logger(page).locator('summary').click(); await configure(page, 'upload', 'reject');
  await logger(page).getByRole('button', { name: 'Attach photo' }).click(); await page.getByRole('dialog', { name: 'Add a reading photo' }).getByRole('button', { name: 'Camera', exact: true }).click();
  await expect(logger(page).getByRole('alert')).toContainText('Fixture upload failed');
  await expect(logger(page).getByAltText('Selected photo awaiting upload')).toBeVisible(); await expect(logger(page).getByRole('button', { name: 'Save progress', exact: true })).toBeDisabled();
  await configure(page, 'upload', 'defer'); await logger(page).getByRole('button', { name: 'Retry upload' }).click();
  await page.keyboard.press('Escape'); await expect(logger(page)).toBeVisible(); await expect(logger(page).getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await settle(page, 'upload', 'resolve'); await expect(logger(page).getByAltText('Attached reading photo')).toBeVisible();
  await logger(page).getByLabel('Page reached').fill('85'); await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click(); await expect(logger(page)).toHaveCount(0);
  expect((await snapshot(page)).logs.find(item => item.page_number === 85)?.photo_url).toMatch(/^data:image/);
});
test('cancelled picker and rejected replacement preserve existing photo', async ({ page }) => {
  await log(page); await logger(page).locator('summary').click(); await configure(page, 'picker', 'defer');
  await logger(page).getByRole('button', { name: 'Attach photo' }).click(); await page.getByRole('dialog', { name: 'Add a reading photo' }).getByRole('button', { name: 'Photo Library' }).click();
  await settle(page, 'picker', 'cancel'); await expect(page.getByRole('dialog', { name: 'Add a reading photo' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(logger(page).getByRole('button', { name: 'Attach photo' })).toBeFocused();
  expect((await snapshot(page)).calls.filter(call => call.operation === 'upload')).toHaveLength(0);
  await configure(page, 'picker', 'resolve'); await logger(page).getByRole('button', { name: 'Attach photo' }).click();
  await page.getByRole('dialog', { name: 'Add a reading photo' }).getByRole('button', { name: 'Photo Library' }).click(); await expect(logger(page).getByAltText('Attached reading photo')).toBeVisible();
  await configure(page, 'upload', 'reject'); await logger(page).getByRole('button', { name: 'Replace photo' }).click();
  await page.getByRole('dialog', { name: 'Add a reading photo' }).getByRole('button', { name: 'Camera', exact: true }).click(); await expect(logger(page).getByRole('alert')).toBeVisible();
  await logger(page).getByRole('button', { name: 'Remove selected photo' }).click(); await expect(logger(page).getByAltText('Attached reading photo')).toBeVisible();
  await logger(page).getByRole('button', { name: 'Remove photo', exact: true }).click(); await expect(logger(page).locator('img')).toHaveCount(0);
});
test('late photo upload after account replacement has no new owner effect', async ({ page }) => {
  await log(page); await logger(page).locator('summary').click(); await configure(page, 'upload', 'defer');
  await logger(page).getByRole('button', { name: 'Attach photo' }).click(); await page.getByRole('dialog', { name: 'Add a reading photo' }).getByRole('button', { name: 'Camera', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).pending.filter(call => call.operation === 'upload').length).toBe(1);
  await page.evaluate(() => window.libraryTasks!.setAccount('reader-b')); await expect(logger(page)).toHaveCount(0); await settle(page, 'upload', 'resolve');
  await page.getByRole('button', { name: 'Log progress', exact: true }).click(); await logger(page).locator('summary').click(); await expect(logger(page).locator('img')).toHaveCount(0);
  expect((await snapshot(page)).outbox).toHaveLength(0);
});
test('correction retains draft across tabs, validates bounds, saves zero without activity', async ({ page }, info) => {
  await open(page); await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  const input = page.getByLabel('Current Page', { exact: true }); await input.fill('17'); const original = await input.elementHandle();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await expect(input).toHaveValue('17'); expect(await input.evaluate((node, first) => node === first, original)).toBe(true);
  for (const value of ['-1', '3.5', '2e2', '301']) {
    await input.fill(value); await page.getByRole('button', { name: 'Correct page', exact: true }).click(); await expect(input).toHaveAttribute('aria-invalid', 'true');
  }
  await input.fill('0'); await fonts(page); await info.attach('correction', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Correct page', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Page 0 saved on this device.' })).toBeVisible();
  const state = await snapshot(page); expect(state.outboxCounts).toEqual({ books: 1, logs: 0 }); expect(state.books.find(book => book.id === 'book-1')?.current_page).toBe(0);
});
test('correction failure keeps draft and pending duplicate submit is suppressed', async ({ page }) => {
  await open(page); await page.getByRole('tab', { name: 'Progress', exact: true }).click(); await configure(page, 'correction', 'reject');
  await page.getByLabel('Current Page', { exact: true }).fill('95'); await page.getByRole('button', { name: 'Correct page', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: "couldn't save" })).toBeVisible(); await expect(page.getByLabel('Current Page', { exact: true })).toHaveValue('95');
  await configure(page, 'correction', 'defer'); await page.getByRole('button', { name: 'Correct page', exact: true }).click();
  await expect(page.getByLabel('Current Page', { exact: true })).toBeDisabled();
  await page.getByRole('form', { name: 'Correct current page' }).evaluate(form => (form as HTMLFormElement).requestSubmit());
  expect((await snapshot(page)).calls.filter(call => call.operation === 'correction')).toHaveLength(2);
  await settle(page, 'correction', 'resolve'); await expect(page.getByRole('status').filter({ hasText: 'Page 95 saved on this device.' })).toBeVisible();
});
test('completion through correction leaves success and controls available', async ({ page }) => {
  await open(page); await page.getByRole('tab', { name: 'Progress', exact: true }).click(); await page.getByLabel('Current Page', { exact: true }).fill('300');
  await expect(page.getByText('Saving the last page also marks this book finished.')).toBeVisible(); await page.getByRole('button', { name: 'Correct page', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Page 300 saved on this device.' })).toBeVisible(); await expect(page.getByLabel('Current Page', { exact: true })).toBeVisible();
  await page.getByLabel('Current Page', { exact: true }).fill('280'); await expect(page.getByText(/keeps its finished status/)).toBeVisible();
  await page.getByRole('button', { name: 'Correct page', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Page 280 saved on this device.' })).toBeVisible();
  expect((await snapshot(page)).books.find(book => book.id === 'book-1')).toMatchObject({ status: 'completed', current_page: 280 });
});
test('route history and insights disclose deliberately and survive offline reconnect', async ({ page }) => {
  await open(page, 'route'); const list = page.getByRole('list', { name: 'Daily reading activity' }); await expect(list.getByRole('listitem')).toHaveCount(2);
  await page.getByText('Pace and insights', { exact: true }).click(); await expect(page.getByText('Days with activity', { exact: true })).toBeVisible();
  await expect(page.locator('.apexcharts-canvas')).toHaveCount(2); await page.getByText('Pace and insights', { exact: true }).click(); await expect(page.locator('.apexcharts-canvas')).toHaveCount(0);
  await page.evaluate(() => window.readingCapture.setNetwork(false)); await expect(list).toBeVisible(); await expect(page.getByText(/Showing activity already loaded/)).toBeVisible();
  await configure(page, 'history', 'reject'); await page.evaluate(() => window.readingCapture.setNetwork(true)); await expect(page.getByText(/Couldn't refresh reading activity/)).toBeVisible(); await expect(list).toBeVisible();
  await configure(page, 'history', 'resolve'); await page.getByRole('button', { name: 'Try again', exact: true }).first().click(); await expect(page.getByText(/Couldn't refresh reading activity/)).toHaveCount(0);
});
test('failed history remains retryable while capture is available; empty has truthful copy', async ({ page }) => {
  await open(page, 'route', 'history=reject&metrics=reject'); await expect(page.getByText(/Reading activity couldn't be loaded/)).toBeVisible();
  await page.getByRole('button', { name: 'Log progress', exact: true }).click(); await expect(logger(page)).toBeVisible(); await logger(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await configure(page, 'history', 'resolve'); await page.getByRole('button', { name: 'Try again', exact: true }).first().click(); await expect(page.getByRole('list', { name: 'Daily reading activity' })).toBeVisible();
  await open(page, 'route', 'emptyHistory'); await expect(page.getByRole('heading', { name: 'No synced activity yet' })).toBeVisible();
});
test('reading route has explicit Back to its book', async ({ page }) => {
  await open(page, 'route'); await page.getByRole('button', { name: 'Back to book', exact: true }).click(); await expect(page).toHaveURL(/\/book\/book-1(?:\?|$)/);
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
});

test('Dashboard Daily Focus capture restores its own invoker', async ({ page }) => {
  await open(page, 'dashboard', 'dailyFocus');
  const trigger = page.getByRole('region', { name: 'A few more pages' }).getByRole('button', { name: 'Log progress', exact: true });
  await trigger.click(); await logger(page).getByLabel('Page reached').fill('86');
  await logger(page).getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(logger(page)).toHaveCount(0); await expect(trigger).toBeFocused();
  expect((await snapshot(page)).outboxCounts).toEqual({ books: 1, logs: 1 });
});
test('keyboard stays inside capture and focused text survives a shorter viewport', async ({ page }) => {
  await log(page, 'route'); await logger(page).locator('summary').click();
  const notes = logger(page).getByLabel('Reading notes'); await notes.fill('Keyboard draft');
  await page.setViewportSize({ width: 390, height: 400 }); await expect(notes).toBeFocused(); await expect(notes).toHaveValue('Keyboard draft');
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press(i < 9 ? 'Tab' : 'Shift+Tab');
    expect(await logger(page).evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(notes).toHaveValue('Keyboard draft');
});
for (const profile of profiles.filter(p => ['tablet', 'compact200', 'dark', 'paper'].includes(p.name))) test(`correction composition ${profile.name}`, async ({ page }, info) => {
  await open(page, 'book', profile.query, profile.width, profile.height); await fonts(page);
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  const section = page.getByRole('region', { name: 'Correct current page' }); await section.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  for (const control of [section.getByLabel('Current Page', { exact: true }), section.getByRole('button', { name: 'Correct page', exact: true })]) {
    await control.scrollIntoViewIfNeeded(); const bounds = (await control.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(profile.width);
  }
  await info.attach('correction', { body: await page.screenshot(), contentType: 'image/png' });
});
test('account change during correction cannot carry its draft or confirmation to replacement', async ({ page }) => {
  await open(page); await page.getByRole('tab', { name: 'Progress', exact: true }).click(); await configure(page, 'correction', 'defer');
  await page.getByLabel('Current Page', { exact: true }).fill('97'); await page.getByRole('button', { name: 'Correct page', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).pending.filter(call => call.operation === 'correction').length).toBe(1);
  await page.evaluate(() => window.libraryTasks!.setAccount('reader-b')); await settle(page, 'correction', 'resolve');
  await page.getByRole('tab', { name: 'Progress', exact: true }).click(); await expect(page.getByLabel('Current Page', { exact: true })).toHaveValue('42');
  await expect(page.getByRole('status').filter({ hasText: 'Page 97 saved' })).toHaveCount(0);
  expect((await snapshot(page)).outbox[0].owner).toBe('shell-reader');
});

test('Book Detail logs retain content on refresh failure and expose retry', async ({ page }) => {
  await open(page, 'book', 'history=reject'); await page.getByRole('tab', { name: 'Logs', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Logs', exact: true });
  await expect(panel.getByRole('alert')).toHaveText('Reading history could not be refreshed. Please try again.');
  await expect(panel).toContainText('A memorable passage.'); await expect(panel.getByRole('heading', { name: 'No reading logs saved here' })).toHaveCount(0);
  await configure(page, 'history', 'defer'); await panel.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(panel).toContainText('A memorable passage.');
  await settle(page, 'history', 'resolve'); await expect(panel.getByRole('alert')).toHaveCount(0); await expect(panel).toContainText('A memorable passage.');
});
test('Book Detail initial history loading and failure are never represented as empty', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/book/book-1?history=defer');
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true'); await page.getByRole('tab', { name: 'Logs', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Logs', exact: true });
  await expect(panel.locator('[aria-busy="true"]')).toBeVisible(); await expect(panel.getByRole('heading', { name: 'No reading logs saved here' })).toHaveCount(0);
  await page.evaluate(() => { window.readingCapture.configure('history', 'reject'); while (window.readingCapture.snapshot().pending.some(call => call.operation === 'history')) window.readingCapture.settle('history', 'reject'); });
  await expect(panel.getByRole('alert')).toBeVisible(); await expect(panel.getByRole('heading', { name: 'No reading logs saved here' })).toHaveCount(0);
  await configure(page, 'history', 'resolve'); await panel.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'No reading logs saved here' })).toBeVisible();
});
test('capture and route primary text keep contrast in available palettes', async ({ page }) => {
  for (const theme of ['', 'theme=dark', 'palette=paper-library']) {
    await log(page, 'route', theme);
    const ratio = await logger(page).getByRole('button', { name: 'Save progress', exact: true }).evaluate(node => {
      const style = getComputedStyle(node);
      const luminance = (color: string) => {
        const c = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
      };
      const a = luminance(style.color), b = luminance(style.backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});

test.describe('touch tablet', () => {
  test.use({ hasTouch: true });
  test('capture uses a sheet and retains its draft when the window expands', async ({ page }, info) => {
    await open(page, 'route', 'runtime=ios', 834, 1112);
    test.skip(!await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches), 'This engine does not expose a coarse pointer in this touch context.');
    await fonts(page); await page.getByRole('button', { name: 'Log progress', exact: true }).tap();
    await expect(logger(page)).toHaveAttribute('data-presentation', 'sheet'); await logger(page).getByLabel('Page reached').fill('88');
    await info.attach('touch-tablet-capture', { body: await page.screenshot(), contentType: 'image/png' });
    await page.setViewportSize({ width: 1440, height: 1000 }); await expect(logger(page)).toHaveAttribute('data-presentation', 'center');
    await expect(logger(page).getByLabel('Page reached')).toHaveValue('88');
    await logger(page).getByRole('button', { name: 'Save progress', exact: true }).tap(); await expect(logger(page)).toHaveCount(0);
    expect((await snapshot(page)).outboxCounts).toEqual({ books: 1, logs: 1 });
  });
});
