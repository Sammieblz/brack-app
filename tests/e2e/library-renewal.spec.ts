import { expect, test, type Locator, type Page } from '@playwright/test';
import type {} from '../fixtures/library-tasks/main';
import type {} from '../fixtures/library-renewal/api';

const title = 'The Left Hand of Darkness';
const firstBook = (page: Page) => page.locator('.library-reading-row').first();
const controls = (page: Page) => page.getByRole('dialog', { name: 'Library controls', exact: true });
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const list: string[] = []; errors.set(page, list); page.on('pageerror', error => list.push(error.message)); });
test.afterEach(async ({ page }, info) => {
  await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' });
  expect(errors.get(page)).toEqual([]);
});
async function open(page: Page, width = 390, query = '', path = '/my-books') {
  await page.setViewportSize({ width, height: width < 768 ? 844 : 1112 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${path}?${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
}
async function ready(page: Page) { await expect(firstBook(page)).toBeVisible(); }
async function fonts(page: Page) {
  const result = await page.evaluate(async () => {
    await Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(font => document.fonts.load(`16px "${font}"`))); await document.fonts.ready;
    return ['Inter', 'Merriweather', 'Playfair Display'].map(family => ({ family,
      loaded: [...document.fonts].some(face => face.family.replace(/["']/g, '') === family && face.status === 'loaded') }));
  });
  for (const font of result) expect(font.loaded, font.family).toBe(true);
  await test.info().attach('fonts', { body: JSON.stringify(result), contentType: 'application/json' });
}
async function usable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate(node => {
    const box = node.getBoundingClientRect();
    let top = 0, left = 0, right = innerWidth, bottom = innerHeight;
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
    }
    return box.width >= 44 && box.height >= 44 && box.left >= left - 1 && box.right <= right + 1 && box.top >= top - 1 && box.bottom <= bottom + 1 &&
      [0.1, 0.5, 0.9].every(ratio => { const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height * ratio); return hit === node || node.contains(hit); });
  })).toBe(true);
}
for (const profile of [
  { name: 'phone', width: 390, query: '' }, { name: 'tablet', width: 834, query: '' }, { name: 'desktop', width: 1280, query: '' },
  { name: 'compact200', width: 320, query: 'text=200&long' }, { name: 'tablet200', width: 834, query: 'text=200&long' },
  { name: 'tabletDark', width: 834, query: 'theme=dark' }, { name: 'phonePaper', width: 390, query: 'palette=paper-library' },
  { name: 'nativePresentation', width: 390, query: 'runtime=android' },
]) {
  test(`Library composition ${profile.name}`, async ({ page }, info) => {
    await open(page, profile.width, profile.query); await ready(page); await fonts(page);
    if (profile.name === 'phonePaper') await expect(page.locator('html')).toHaveAttribute('data-brack-theme-style', 'paper');
    await expect(page.getByRole('group', { name: 'Reading status', exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="Library snapshot"]')).toHaveCount(0);
    await expect(firstBook(page).getByRole('button', { name: 'Delete book', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const geometry = await page.evaluate(() => ({ headerHeight: document.querySelector('header')!.getBoundingClientRect().height,
      firstBookTop: document.querySelector('.library-reading-row')!.getBoundingClientRect().top }));
    await info.attach('composition-measurements', { body: JSON.stringify(geometry), contentType: 'application/json' });
    if (profile.name === 'phone') { expect(geometry.headerHeight).toBeLessThan(80); expect(geometry.firstBookTop).toBeLessThan(330); }
    await info.attach('initial-library', { body: await page.screenshot(), contentType: 'image/png' });
    for (const control of await page.getByRole('group', { name: 'Reading status', exact: true }).getByRole('button').all()) await usable(control);
    await usable(page.getByRole('link', { name: 'Add Book', exact: true }));
    await usable(firstBook(page).getByRole('link', { name: 'Log progress', exact: true }));
    expect(await firstBook(page).getByRole('heading').evaluate(node => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    await info.attach('book-row', { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: 'Library controls', exact: true }).click();
    const sheet = controls(page); await expect(sheet).toBeVisible();
    for (const name of ['Flat view', 'Bookshelf view', 'Carousel view', 'Select', 'Show books']) await usable(sheet.getByRole('button', { name, exact: true }));
    await usable(sheet.getByRole('combobox', { name: 'Sort books', exact: true }));
    await usable(sheet.getByRole('link', { name: 'Book Lists', exact: true }));
    await usable(sheet.getByRole('link', { name: 'Analytics', exact: true }));
    await info.attach('controls', { body: await page.screenshot(), contentType: 'image/png' });
    await sheet.getByRole('button', { name: 'Show books', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Library controls', exact: true })).toBeFocused();
  });
}
for (const path of ['/my-books', '/books']) {
  test(`Search, status, genre, sort and real BookDetail Back retain context ${path}`, async ({ page }) => {
    await open(page, 834, 'mixed', path); await ready(page);
    const status = page.getByRole('group', { name: 'Reading status', exact: true });
    await expect(status.getByRole('button', { name: /^All 3 books$/ })).toHaveAttribute('aria-pressed', 'true');
    for (const name of ['Reading', 'Finished', 'To read']) await expect(status.getByRole('button', { name: `${name} 1 book`, exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search your library' }).fill('Le Guin');
    await status.getByRole('button', { name: /^Reading / }).click();
    await page.getByRole('button', { name: 'Library controls', exact: true }).click();
    await controls(page).getByRole('button', { name: 'Fiction', exact: true }).click();
    await controls(page).getByRole('combobox', { name: 'Sort books' }).click();
    await page.getByRole('option', { name: 'Title', exact: true }).click();
    await controls(page).getByRole('button', { name: 'Show books' }).click();
    await expect(page.locator('.library-reading-row')).toHaveCount(1);
    const url = page.url();
    expect(new URL(url).searchParams.get('q')).toBe('Le Guin');
    expect(new URL(url).searchParams.get('status')).toBe('reading');
    expect(new URL(url).searchParams.get('genre')).toBe('Fiction');
    expect(new URL(url).searchParams.get('sort')).toBe('title_asc');
    await firstBook(page).getByRole('heading', { name: title, exact: true }).click();
    await expect(page).toHaveURL(/\/book\/book-1$/);
    await page.getByRole('button', { name: 'Back to library', exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('searchbox')).toHaveValue('Le Guin');
    await expect(page.locator('.library-reading-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.locator('.library-reading-row')).toHaveCount(3);
    expect(new URL(page.url()).searchParams.has('mixed')).toBe(true);
    for (const key of ['q', 'status', 'genre', 'sort']) expect(new URL(page.url()).searchParams.has(key)).toBe(false);
  });
}
test('controls keep DOM, focus, selected filters and one owner across window changes', async ({ page }) => {
  await open(page, 390, 'runtime=android&mixed'); await ready(page);
  const trigger = page.getByRole('button', { name: 'Library controls', exact: true }); await trigger.click();
  const genre = controls(page).getByRole('button', { name: 'Fantasy', exact: true }); await genre.click(); await genre.focus();
  const node = await genre.elementHandle();
  for (const width of [767, 768, 834, 1024, 1280, 390]) {
    await page.setViewportSize({ width, height: 900 }); await expect(genre).toBeFocused();
    await expect(genre).toHaveAttribute('aria-pressed', 'true');
    expect(await genre.evaluate((current, previous) => current === previous, node)).toBe(true);
    await expect(controls(page)).toHaveCount(1);
  }
  await page.evaluate(() => window.libraryTasks!.back()); await expect(controls(page)).toHaveCount(0); await expect(trigger).toBeFocused();
  await expect(page.locator('.library-reading-row')).toHaveCount(1);
});
test('view choices preserve modes, selection and a reachable reorder exit', async ({ page }) => {
  await open(page); await ready(page);
  const trigger = page.getByRole('button', { name: 'Library controls', exact: true });
  await trigger.click(); await controls(page).getByRole('button', { name: 'Select', exact: true }).click();
  await expect(controls(page)).toHaveCount(0);
  await page.getByRole('button', { name: `Select ${title}`, exact: true }).press('Space');
  await expect(page.getByText('1 book selected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await trigger.click(); await controls(page).getByRole('button', { name: 'Bookshelf view', exact: true }).click();
  await expect(controls(page).getByRole('combobox', { name: 'Sort books' })).toHaveText('Shelf order');
  await controls(page).getByRole('button', { name: 'Reorder', exact: true }).click();
  await expect(controls(page)).toHaveCount(0);
  await expect(page.getByText('Reorder your shelf using the handles, keyboard, or Earlier and Later buttons.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await trigger.click(); await controls(page).getByRole('button', { name: 'Carousel view', exact: true }).click();
  await expect(controls(page).getByRole('combobox', { name: 'Sort books' })).toHaveText('Recently updated');
  await controls(page).getByRole('button', { name: 'Show books' }).click();
  await expect(page.locator('.library-carousel-card')).toHaveCount(3);
  await trigger.click(); await controls(page).getByRole('button', { name: 'Flat view', exact: true }).click();
  await controls(page).getByRole('button', { name: 'Show books' }).click(); await ready(page);
});
test('inline Quick actions retains timer handoff and focus after resizing', async ({ page }) => {
  await open(page); await ready(page);
  const trigger = page.getByRole('button', { name: 'Quick actions', exact: true }); await trigger.click();
  await page.getByRole('dialog', { name: 'Quick actions', exact: true }).getByRole('button', { name: 'Start Reading Timer', exact: true }).click();
  const timer = page.getByRole('dialog', { name: 'Start reading timer', exact: true }); await expect(timer).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 1000 }); await expect(timer).toBeVisible();
  await timer.getByRole('button', { name: 'Close', exact: true }).click(); await expect(trigger).toBeFocused();
  await expect(page.locator('[data-shell-float="action"]')).toHaveCount(0);
});
test('initial loading becomes books without a false empty state; failed read can retry', async ({ page }, info) => {
  await open(page, 390, 'data=defer');
  await expect(page.locator('[aria-label="Loading your library"][aria-busy="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No books yet' })).toHaveCount(0);
  await info.attach('initial-loading', { body: await page.screenshot(), contentType: 'image/png' });
  await page.evaluate(() => window.libraryPresentation.setMode('ready')); await ready(page);
  await open(page, 390, 'data=error');
  await expect(page.getByRole('alert')).toContainText("We couldn't refresh your library");
  await expect(page.getByRole('heading', { name: 'No books yet' })).toHaveCount(0);
  await page.evaluate(() => window.libraryPresentation.setMode('ready'));
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await ready(page);
});
test('empty and filtered empty explain the next action without removing search', async ({ page }) => {
  await open(page, 390, 'data=empty'); await expect(page.getByRole('heading', { name: 'No books yet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Your First Book', exact: true })).toBeVisible();
  await open(page); await ready(page); await page.getByRole('searchbox').fill('No matching title');
  await expect(page.getByRole('heading', { name: 'No books found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click(); await ready(page);
});
test('tablet touch opens the real Lists destination from the controls', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 834, height: 1112 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); await open(page, 834); await ready(page);
  await page.getByRole('button', { name: 'Library controls', exact: true }).tap();
  await controls(page).getByRole('link', { name: 'Book Lists', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Weekend reading', exact: true })).toBeVisible(); await context.close();
});
