import { expect, test, type Page } from '@playwright/test';
import type {} from '../fixtures/reading-session/main';
import type { SessionMode, SessionOperation } from '../fixtures/reading-session/api';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const entries: string[] = []; errors.set(page, entries); page.on('pageerror', error => entries.push(error.message)); });
test.afterEach(async ({ page }, info) => { await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' }); expect(errors.get(page)).toEqual([]); });
const form = (page: Page) => page.getByRole('form', { name: 'Book details', exact: true });
const title = (page: Page) => form(page).getByLabel('Title *', { exact: true });
const save = (page: Page) => page.getByRole('button', { name: 'Save Changes', exact: true });
const configure = (page: Page, operation: SessionOperation, mode: SessionMode) => page.evaluate(({ operation, mode }) => window.readingSession.configure(operation, mode), { operation, mode });
const edits = (page: Page) => page.evaluate(() => window.readingSession.snapshot().calls.filter(call => call.operation === 'edit'));
const currentBook = (page: Page) => page.evaluate(() => window.readingCapture.snapshot().books.find(book => book.id === 'book-1'));
async function visit(page: Page, path = '/edit-book/book-1', query = '', width = 390, height = 844) {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${path}?populated&${query}`); await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
}
async function open(page: Page, query = '', width = 390, height = 844) {
  await visit(page, '/edit-book/book-1', query, width, height); await expect(title(page)).toHaveValue(/The Left Hand of Darkness/);
}
async function section(page: Page, name: string) { await form(page).locator('summary').filter({ hasText: name }).click(); }
async function submit(page: Page) { await save(page).scrollIntoViewIfNeeded(); await save(page).click(); }
async function saved(page: Page) { await expect(page).toHaveURL(/\/book\/book-1(?:\?|$)/); await expect(page.getByRole('button', { name: 'Log progress', exact: true })).toBeVisible(); }
async function settled(page: Page, operation: SessionOperation, outcome: 'resolve' | 'reject') {
  await page.evaluate(({ operation, outcome }) => {
    while (window.readingSession.snapshot().pending.some(entry => entry.operation === operation)) window.readingSession.settle(operation, outcome);
  }, { operation, outcome });
}
async function fontFaces(page: Page) {
  expect(await page.evaluate(async () => {
    const families = ['Inter', 'Merriweather', 'Playfair Display'];
    await Promise.all(families.map(family => document.fonts.load(`16px "${family}"`))); await document.fonts.ready;
    return families.every(family => [...document.fonts].some(face => face.family.replace(/["']/g, '') === family && face.status === 'loaded'));
  })).toBe(true);
}

for (const profile of [
  { name: 'phone', width: 390, height: 844, query: '' },
  { name: 'tablet', width: 834, height: 1112, query: '' },
  { name: 'desktop', width: 1440, height: 1000, query: '' },
  { name: 'compact200', width: 320, height: 900, query: 'text=200&long' },
  { name: 'landscape', width: 844, height: 390, query: '' },
  { name: 'dark', width: 834, height: 1112, query: 'theme=dark' },
  { name: 'paper', width: 390, height: 844, query: 'palette=paper-library' },
]) test(`editor composition ${profile.name}`, async ({ page }, info) => {
  await open(page, profile.query, profile.width, profile.height); await fontFaces(page);
  await expect(form(page).getByLabel('Notes', { exact: true })).not.toBeVisible();
  await expect(form(page).getByLabel('Total Pages', { exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await info.attach('editor-essentials', { body: await page.screenshot(), contentType: 'image/png' });
  await section(page, 'Edition and series'); await section(page, 'Notes and tags');
  await form(page).getByLabel('Notes', { exact: true }).fill('A note for the next reread.');
  if (profile.name === 'compact200') {
    const tag = form(page).getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Remove tag Revisit', exact: true }) });
    const labelLines = await tag.locator('span').evaluate(element => {
      const text = document.createRange(); text.selectNodeContents(element); return text.getClientRects().length;
    });
    expect(labelLines).toBe(1); // Let Remove wrap below, instead of crushing a short tag into character columns.
    expect((await tag.getByRole('button', { name: 'Remove tag Revisit', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await save(page).scrollIntoViewIfNeeded(); const bounds = (await save(page).boundingBox())!;
  expect(bounds.height).toBeGreaterThanOrEqual(44); expect(bounds.x).toBeGreaterThanOrEqual(-1); expect(bounds.x + bounds.width).toBeLessThanOrEqual(profile.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await info.attach('editor-details-and-actions', { body: await page.screenshot(), contentType: 'image/png' });
});

test('editor enters from BookDetail More and returns to the updated real book', async ({ page }) => {
  await visit(page, '/book/book-1'); await page.getByRole('button', { name: 'More actions for The Left Hand of Darkness', exact: true }).click();
  await page.getByRole('button', { name: 'Edit book', exact: true }).click(); await expect(form(page)).toBeVisible();
  await title(page).fill('The book I will return to'); await submit(page); await saved(page);
  await expect(page.getByRole('heading', { name: 'The book I will return to', exact: true })).toBeVisible();
  expect(await edits(page)).toHaveLength(1);
});

test('editor enters from the Library book action and cancels to its actual book', async ({ page }) => {
  await visit(page, '/my-books'); await page.getByRole('button', { name: 'More actions for The Left Hand of Darkness', exact: true }).click();
  await page.getByRole('button', { name: 'Edit book', exact: true }).click(); await expect(form(page)).toBeVisible();
  await form(page).getByRole('button', { name: 'Cancel', exact: true }).click(); await saved(page);
  expect(await edits(page)).toHaveLength(0);
});

test('editor uses the local book offline and preserves unrelated optional values', async ({ page }) => {
  await open(page, 'offline'); const before = (await currentBook(page))!;
  await title(page).fill('An offline title'); await submit(page); await saved(page);
  const after = (await currentBook(page))!;
  expect(after).toMatchObject({ title: 'An offline title', author: before.author, current_page: before.current_page, pages: before.pages,
    notes: before.notes, rating: before.rating, date_started: before.date_started, isbn: before.isbn, tags: before.tags });
  expect(await edits(page)).toEqual([expect.objectContaining({ payload: { id: 'book-1', updates: { title: 'An offline title' } } })]);
  const state = await page.evaluate(() => window.readingCapture.snapshot()); expect(state.outboxCounts.books).toBe(1); expect(state.outboxCounts.logs).toBe(0);
});

test('editor shows load failure and preserves the route through retry', async ({ page }) => {
  await visit(page, '/edit-book/book-1', 'book-read=reject'); await expect(page.getByText('Fixture book-read failed', { exact: true })).toBeVisible();
  await expect(form(page)).toHaveCount(0); await configure(page, 'book-read', 'resolve'); await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(title(page)).toHaveValue('The Left Hand of Darkness');
});

test('editor waits for its local book and does not show an empty form during a deferred load', async ({ page }) => {
  await visit(page, '/edit-book/book-1', 'book-read=defer');
  await expect.poll(() => page.evaluate(() => window.readingSession.snapshot().pending.filter(call => call.operation === 'book-read').length)).toBeGreaterThan(0);
  await expect(form(page)).toHaveCount(0); await configure(page, 'book-read', 'resolve'); await settled(page, 'book-read', 'resolve');
  await expect(title(page)).toHaveValue('The Left Hand of Darkness');
});

test('editor explains an unavailable offline book without accepting a save', async ({ page }) => {
  await visit(page, '/edit-book/book-1', 'missing&offline'); await expect(page.getByText('This book is not on this device yet. Reconnect and try again.', { exact: true })).toBeVisible();
  await expect(form(page)).toHaveCount(0); expect(await edits(page)).toHaveLength(0);
});

test('editor title-only save preserves a reading position changed after opening', async ({ page }) => {
  await open(page); await title(page).fill('A revised title');
  await page.evaluate(() => window.readingCapture.patchBook('book-1', { current_page: 190, status: 'reading' }));
  await submit(page); await saved(page); expect(await currentBook(page)).toMatchObject({ title: 'A revised title', current_page: 190 });
  expect((await edits(page))[0].payload).toEqual({ id: 'book-1', updates: { title: 'A revised title' } });
});

test('editor revalidates a page-count correction against newer reading and keeps edited metadata', async ({ page }) => {
  await open(page); await title(page).fill('Keep this title'); await section(page, 'Edition and series'); await form(page).getByLabel('Total Pages', { exact: true }).fill('100');
  await page.evaluate(() => window.readingCapture.patchBook('book-1', { current_page: 190 })); await submit(page);
  await expect(form(page).getByLabel('Current Page', { exact: true })).toHaveValue('190'); await expect(title(page)).toHaveValue('Keep this title');
  await expect(page).toHaveURL(/\/edit-book\/book-1/); await form(page).getByLabel('Total Pages', { exact: true }).fill('220'); await submit(page); await saved(page);
  expect(await currentBook(page)).toMatchObject({ title: 'Keep this title', current_page: 190, pages: 220 });
});

test('editor validates raw numbers before save and keeps zero, null, rating and half-book meanings', async ({ page }) => {
  await open(page); await form(page).getByLabel('Current Page', { exact: true }).fill('12abc'); await submit(page);
  await expect(form(page).getByLabel('Current Page', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(form(page).getByLabel('Current Page', { exact: true })).toBeFocused(); expect(await edits(page)).toHaveLength(0);
  await form(page).getByLabel('Current Page', { exact: true }).fill('0'); await form(page).getByLabel('Rating', { exact: true }).selectOption('');
  await section(page, 'Edition and series'); await form(page).getByLabel('Total Pages', { exact: true }).fill('');
  await form(page).getByLabel('Total Chapters', { exact: true }).fill('2.5'); await submit(page);
  await expect(form(page).getByLabel('Total Chapters', { exact: true })).toHaveAttribute('aria-invalid', 'true'); expect(await edits(page)).toHaveLength(0);
  await form(page).getByLabel('Total Chapters', { exact: true }).fill(''); await form(page).getByLabel('Series', { exact: true }).fill('The Hainish Cycle');
  await form(page).getByLabel('Book #', { exact: true }).fill('1.5'); await submit(page); await saved(page);
  expect(await currentBook(page)).toMatchObject({ current_page: 0, pages: null, chapters: null, rating: null, series_name: 'The Hainish Cycle', series_position: 1.5, status: 'reading' });
});

test('editor rejects an invalid date draft and preserves the valid ordered dates', async ({ page }) => {
  await open(page); await form(page).getByLabel('Date Finished', { exact: true }).fill('02/30/2026');
  await expect(save(page)).toBeDisabled(); await form(page).getByLabel('Date Finished', { exact: true }).fill('08/31/2026');
  await expect(save(page)).toBeDisabled(); expect(await edits(page)).toHaveLength(0);
  await form(page).getByLabel('Date Finished', { exact: true }).fill('09/30/2026'); await expect(save(page)).toBeEnabled();
  await submit(page); await saved(page); expect(await currentBook(page)).toMatchObject({ date_started: '2026-09-01', date_finished: '2026-09-30', status: 'reading' });
});

test('editor tag draft participates in Back protection and saves even before Add tag', async ({ page }) => {
  await open(page, 'runtime=android'); await section(page, 'Notes and tags'); await form(page).getByLabel('Add a tag', { exact: true }).fill('Quiet reread');
  await page.getByRole('button', { name: 'Back to book', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true }); await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click(); await expect(form(page).getByLabel('Add a tag', { exact: true })).toHaveValue('Quiet reread');
  await submit(page); await saved(page); expect((await currentBook(page))?.tags).toEqual(['Fiction', 'Revisit', 'Quiet reread']);
});

test('editor failed save retains the draft and retry commits once', async ({ page }) => {
  await open(page); await configure(page, 'edit', 'reject'); await title(page).fill('Draft after failure'); await submit(page);
  await expect(form(page).locator('#book-save-error')).toHaveText('Fixture edit failed'); await expect(title(page)).toHaveValue('Draft after failure');
  expect((await page.evaluate(() => window.readingCapture.snapshot())).outboxCounts.books).toBe(0);
  await configure(page, 'edit', 'resolve'); await submit(page); await saved(page);
  expect((await page.evaluate(() => window.readingCapture.snapshot())).outboxCounts.books).toBe(1); expect(await currentBook(page)).toMatchObject({ title: 'Draft after failure' });
});

test('editor serializes a pending save and blocks app Back until completion', async ({ page }) => {
  await open(page, 'runtime=android'); await configure(page, 'edit', 'defer'); await title(page).fill('One committed edit'); await submit(page);
  await expect(page.getByRole('button', { name: 'Saving...', exact: true })).toBeDisabled(); await expect(title(page)).toBeDisabled();
  await page.evaluate(() => window.libraryTasks!.back()); await expect(page).toHaveURL(/\/edit-book\/book-1/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0); expect(await edits(page)).toHaveLength(1);
  await settled(page, 'edit', 'resolve'); await saved(page); expect((await page.evaluate(() => window.readingCapture.snapshot())).outboxCounts.books).toBe(1);
});

test('editor obsolete pending save cannot mutate or navigate the replacement account', async ({ page }) => {
  await open(page); await configure(page, 'edit', 'defer'); await title(page).fill('Old reader private edit'); await submit(page);
  await expect.poll(async () => (await edits(page)).length).toBe(1); await page.evaluate(() => window.libraryTasks!.setAccount('second-reader'));
  await expect(title(page)).toHaveValue('The Left Hand of Darkness'); await settled(page, 'edit', 'resolve');
  await expect(page).toHaveURL(/\/edit-book\/book-1/); await expect(title(page)).toHaveValue('The Left Hand of Darkness');
  expect((await page.evaluate(() => window.readingCapture.snapshot())).outboxCounts.books).toBe(0);
});

test('editor cover upload keeps concurrent text and its task through resize; retry applies only on Save', async ({ page }) => {
  await open(page); await section(page, 'Cover image'); await page.evaluate(() => window.readingCapture.configure('upload', 'defer'));
  await form(page).getByRole('button', { name: 'Choose Image', exact: true }).click();
  await page.getByRole('dialog', { name: 'Choose Cover Image', exact: true }).getByRole('button', { name: 'Photo Library', exact: true }).click();
  await expect(form(page).getByText('Uploading cover...', { exact: true })).toBeVisible(); await title(page).fill('Edited during upload');
  await page.setViewportSize({ width: 1440, height: 1000 }); await expect(title(page)).toHaveValue('Edited during upload'); await expect(save(page)).toBeDisabled();
  await page.evaluate(() => window.readingCapture.settle('upload', 'reject'));
  await expect(form(page).getByRole('button', { name: 'Retry cover upload', exact: true })).toBeVisible();
  await expect(form(page).getByRole('img', { name: 'Selected cover awaiting upload', exact: true })).toBeVisible();
  expect((await currentBook(page))?.cover_url).toBeNull();
  await page.evaluate(() => window.readingCapture.configure('upload', 'resolve')); await form(page).getByRole('button', { name: 'Retry cover upload', exact: true }).click();
  await expect(form(page).getByLabel('Cover image URL', { exact: true })).toHaveValue(/^data:image\/png/); await expect(title(page)).toHaveValue('Edited during upload');
  expect((await currentBook(page))?.cover_url).toBeNull(); await submit(page); await saved(page);
  expect(await currentBook(page)).toMatchObject({ title: 'Edited during upload', cover_url: expect.stringMatching(/^data:image\/png/) });
});

test('editor obsolete upload does not replace another reader cover or draft', async ({ page }) => {
  await open(page); await section(page, 'Cover image'); await page.evaluate(() => window.readingCapture.configure('upload', 'defer'));
  await form(page).getByRole('button', { name: 'Choose Image', exact: true }).click();
  await page.getByRole('dialog', { name: 'Choose Cover Image', exact: true }).getByRole('button', { name: 'Photo Library', exact: true }).click();
  await expect(form(page).getByText('Uploading cover...', { exact: true })).toBeVisible(); await page.evaluate(() => window.libraryTasks!.setAccount('second-reader'));
  await expect(title(page)).toHaveValue('The Left Hand of Darkness'); await page.evaluate(() => window.readingCapture.settle('upload', 'resolve'));
  await section(page, 'Cover image'); await expect(form(page).getByLabel('Cover image URL', { exact: true })).toHaveValue('');
  expect((await currentBook(page))?.cover_url).toBeNull(); expect(await edits(page)).toHaveLength(0);
});
