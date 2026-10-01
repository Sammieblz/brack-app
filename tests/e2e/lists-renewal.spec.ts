import { expect, test, type Locator, type Page } from '@playwright/test';
import type {} from '../fixtures/library-tasks/main';

const firstTitle = 'The Left Hand of Darkness';
const rows = (page: Page) => page.locator('.collection-book');
const sheet = (page: Page) => page.getByRole('dialog', { name: 'List controls', exact: true });
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const list: string[] = []; errors.set(page, list); page.on('pageerror', error => list.push(error.message)); });
test.afterEach(async ({ page }, info) => {
  await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' });
  await info.attach('services', { body: JSON.stringify(await page.evaluate(() => window.libraryTasks?.snapshot()).catch(() => null)), contentType: 'application/json' });
  expect(errors.get(page)).toEqual([]);
});
async function open(page: Page, path: string, width = 390, query = '') {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${path}?listRenewal&${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(page.locator(path.includes('list-1') ? '.collection-book' : '.collection-row').first()).toBeVisible();
}
async function fonts(page: Page) {
  const loaded = await page.evaluate(async () => {
    await Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(font => document.fonts.load(`16px "${font}"`))); await document.fonts.ready;
    return ['Inter', 'Merriweather', 'Playfair Display'].map(family => [...document.fonts].some(face => face.family.replace(/["']/g, '') === family && face.status === 'loaded'));
  });
  expect(loaded).toEqual([true, true, true]);
}
async function usable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate(node => {
    const box = node.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44 && box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1 &&
      [0.1, 0.5, 0.9].every(ratio => { const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height * ratio); return hit === node || node.contains(hit); });
  })).toBe(true);
}
const order = (page: Page) => rows(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-book-id')));
const writeCalls = (page: Page) => page.evaluate(() => window.libraryTasks!.snapshot().calls.filter(call => call.operation === 'list-reorder'));
for (const profile of [
  { name: 'phone', width: 390, query: '' }, { name: 'tablet', width: 834, query: '' },
  { name: 'desktop', width: 1280, query: '' }, { name: 'compact200', width: 320, query: 'text=200&long' },
  { name: 'tablet200', width: 834, query: 'text=200&long' }, { name: 'dark', width: 834, query: 'theme=dark' },
  { name: 'paper', width: 390, query: 'palette=paper-library' }, { name: 'nativePresentation', width: 390, query: 'runtime=android' },
]) for (const path of ['/lists', '/lists/list-1']) {
  test(`composition ${path} ${profile.name}`, async ({ page }, info) => {
    await open(page, path, profile.width, profile.query); await fonts(page);
    const listing = path === '/lists';
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await info.attach('composition', { body: await page.screenshot(), contentType: 'image/png' });
    const title = page.locator(listing ? '.collection-title' : '.library-reading-row__title').first();
    expect(await title.evaluate(node => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    if (profile.name === 'compact200') {
      const row = page.locator(listing ? '.collection-row' : '.collection-book').first();
      expect((await title.boundingBox())!.width).toBeGreaterThanOrEqual((await row.boundingBox())!.width * 0.75);
    }
    if (listing) {
      await expect(page.getByText('Most stocked list')).toHaveCount(0);
      if (profile.name === 'phone') expect(await page.locator('.collection-row').first().evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(350);
      await usable(page.getByRole('button', { name: 'Create List', exact: true }));
      await usable(page.locator('.collection-actions').first());
      await page.getByRole('button', { name: 'List controls', exact: true }).click();
      for (const name of ['All', 'With books', 'Empty', 'Public', 'Private', 'Show lists']) await usable(sheet(page).getByRole('button', { name, exact: true }));
      await usable(sheet(page).getByRole('combobox', { name: 'Sort lists' }));
      await info.attach('controls', { body: await page.screenshot(), contentType: 'image/png' });
      await sheet(page).getByRole('button', { name: 'Show lists', exact: true }).click();
      await expect(page.getByRole('button', { name: 'List controls', exact: true })).toBeFocused();
    } else {
      await expect(page.getByRole('button', { name: /^Move / })).toHaveCount(0);
      await usable(page.getByRole('button', { name: 'Add Books', exact: true }));
      await usable(rows(page).first().getByRole('button', { name: /Remove .* from list/ }));
      await page.getByRole('button', { name: 'Reorder', exact: true }).click();
      for (const control of await rows(page).first().getByRole('button').all()) await usable(control);
      await usable(page.getByRole('button', { name: 'Done reordering' }));
      await info.attach('reorder', { body: await page.screenshot(), contentType: 'image/png' });
    }
  });
}
for (const path of ['/lists', '/book-lists']) test(`filter/sort/search and detail Back preserve context ${path}`, async ({ page }) => {
  await open(page, path);
  await page.getByRole('button', { name: 'List controls', exact: true }).click();
  for (const [name, count] of [['With books', 1], ['Empty', 2], ['Public', 1], ['Private', 2], ['All', 3]] as const) {
    await sheet(page).getByRole('button', { name, exact: true }).click();
    await expect(sheet(page).getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.collection-row')).toHaveCount(count);
  }
  for (const value of ['created_desc', 'count_desc', 'name_asc', 'updated_desc']) {
    await sheet(page).getByRole('combobox', { name: 'Sort lists' }).selectOption(value);
    expect(new URL(page.url()).searchParams.get('sort')).toBe(value === 'updated_desc' ? null : value);
  }
  await sheet(page).getByRole('button', { name: 'With books', exact: true }).click();
  await sheet(page).getByRole('combobox', { name: 'Sort lists' }).selectOption('name_asc');
  await sheet(page).getByRole('button', { name: 'Show lists', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search lists' }).fill('weekend');
  const url = page.url();
  const destination = page.getByRole('link', { name: 'Open Weekend reading', exact: true });
  await expect(destination).toHaveAttribute('href', '/lists/list-1');
  await destination.focus(); await page.keyboard.press('Enter');
  await expect(rows(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page).toHaveURL(url); await expect(page.getByRole('searchbox')).toHaveValue('weekend');
  await page.getByRole('button', { name: 'List controls', exact: true }).click();
  await sheet(page).getByRole('button', { name: 'Clear filters', exact: true }).click();
  await sheet(page).getByRole('button', { name: 'Show lists', exact: true }).click();
  await expect(page.locator('.collection-row')).toHaveCount(3);
  expect(new URL(page.url()).searchParams.has('listRenewal')).toBe(true);
});
test('controls keep the same focused node through resize and no matches recovers', async ({ page }) => {
  await open(page, '/lists');
  await page.getByRole('button', { name: 'List controls', exact: true }).click();
  const selected = sheet(page).getByRole('button', { name: 'Private', exact: true }); await selected.click(); await selected.focus();
  const handle = await selected.elementHandle();
  for (const width of [767, 768, 834, 1024, 1280, 390]) {
    await page.setViewportSize({ width, height: 900 }); await expect(selected).toBeFocused();
    expect(await selected.evaluate((node, original) => node === original, handle)).toBe(true);
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
  }
  await page.keyboard.press('Escape'); await expect(sheet(page)).toHaveCount(0);
  await page.getByRole('searchbox').fill('no such list');
  await expect(page.getByRole('heading', { name: 'No matching lists' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.collection-row')).toHaveCount(3);
});
test('visible reorder serializes, rolls back rejection, retains focus and persists one retry', async ({ page }) => {
  await open(page, '/lists/list-1');
  await page.getByRole('button', { name: 'Reorder', exact: true }).click();
  await page.evaluate(() => window.libraryTasks!.configure('list-reorder', 'defer'));
  const down = page.getByRole('button', { name: `Move ${firstTitle} down`, exact: true });
  await down.focus(); await down.press('Enter');
  await expect.poll(() => writeCalls(page).then(calls => calls.length)).toBe(1);
  await expect(down).toHaveAttribute('aria-disabled', 'true');
  await down.press('Enter'); expect(await writeCalls(page)).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Done reordering' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add Books', exact: true })).toBeDisabled();
  await page.evaluate(() => window.libraryTasks!.settle('list-reorder', 'reject'));
  await expect(page.getByRole('alert')).toContainText('previous order has been restored');
  await expect.poll(() => order(page)).toEqual(['book-1', 'book-2', 'book-3']); await expect(down).toBeFocused();
  await page.evaluate(() => window.libraryTasks!.configure('list-reorder', 'resolve'));
  await down.press('Enter');
  await expect.poll(() => order(page)).toEqual(['book-2', 'book-1', 'book-3']);
  await expect(page.getByRole('status').filter({ hasText: 'moved to position 2 of 3' })).toBeVisible();
  expect(await writeCalls(page)).toHaveLength(2); await expect(down).toBeFocused();
  await page.getByRole('button', { name: 'Done reordering' }).click();
  await expect(page.getByRole('button', { name: /^Move / })).toHaveCount(0);
  await rows(page).first().getByRole('link').click();
  await expect(page).toHaveURL(/book\/book-2$/);
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect.poll(() => order(page)).toEqual(['book-2', 'book-1', 'book-3']);
});
test('keyboard drag cancels without a write and a subsequent drop saves', async ({ page }) => {
  await open(page, '/lists/list-1'); await page.getByRole('button', { name: 'Reorder', exact: true }).click();
  const drag = page.getByRole('button', { name: `Move ${firstTitle}`, exact: true });
  await drag.focus(); await page.keyboard.press('Space');
  await expect(rows(page).first()).toHaveAttribute('data-dragging', 'true');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
  expect(await writeCalls(page)).toHaveLength(0); await expect.poll(() => order(page)).toEqual(['book-1', 'book-2', 'book-3']);
  await drag.focus(); await page.keyboard.press('Space');
  await expect(rows(page).first()).toHaveAttribute('data-dragging', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('status').filter({ hasText: `${firstTitle}, target position 2 of 3` })).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect.poll(() => order(page)).toEqual(['book-2', 'book-1', 'book-3']);
  await expect.poll(() => writeCalls(page).then(calls => calls.length)).toBe(1);
});

test('pointer reorder uses only its handle, persists and never opens the book', async ({ page }) => {
  await open(page, '/lists/list-1'); await page.getByRole('button', { name: 'Reorder', exact: true }).click();
  const handle = page.getByRole('button', { name: `Move ${firstTitle}`, exact: true });
  await handle.scrollIntoViewIfNeeded(); const from = (await handle.boundingBox())!;
  const to = (await rows(page).nth(1).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 3 });
  await expect(rows(page).first()).toHaveAttribute('data-dragging', 'true');
  await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, { steps: 15 });
  await expect(page.getByRole('status').filter({ hasText: `${firstTitle}, target position 2 of 3` })).toHaveCount(1);
  await page.mouse.up();
  await expect.poll(() => order(page)).toEqual(['book-2', 'book-1', 'book-3']);
  await expect.poll(() => writeCalls(page).then(calls => calls.length)).toBe(1);
  await expect(page).toHaveURL(/lists\/list-1/);
});
test('reorder account replacement ignores late outcome and membership still opens', async ({ page }) => {
  await open(page, '/lists/list-1'); await page.getByRole('button', { name: 'Reorder', exact: true }).click();
  await page.evaluate(() => window.libraryTasks!.configure('list-reorder', 'defer'));
  await page.getByRole('button', { name: `Move ${firstTitle} down`, exact: true }).click();
  await expect.poll(() => writeCalls(page).then(calls => calls.length)).toBe(1);
  await page.evaluate(() => window.libraryTasks!.setAccount('second-reader'));
  await expect(page.getByRole('button', { name: 'Reorder', exact: true })).toBeVisible();
  await page.evaluate(() => window.libraryTasks!.settle('list-reorder', 'resolve'));
  await expect.poll(() => order(page)).toEqual(['book-1', 'book-2', 'book-3']);
  await expect(page.getByText('Order updated', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Books', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add Books to List', exact: true })).toBeVisible();
});
test('selected list filters have a reset after the matching collection is deleted', async ({ page }) => {
  await open(page, '/lists');
  await page.getByRole('searchbox').fill('Weekend');
  await page.getByRole('button', { name: 'Actions for Weekend reading', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delete list?' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No matching lists' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.collection-row')).toHaveCount(2);
});

test('cold catalog load, failure and retry use honest states and matching skeletons', async ({ page }) => {
  await page.goto('/lists?catalogRead=defer');
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(page.locator('[data-skeleton="book-list-card"]').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create your first list' })).toHaveCount(0);
  await page.evaluate(() => {
    while (window.libraryTasks!.snapshot().pending.some(call => call.operation === 'catalog')) window.libraryTasks!.settle('catalog', 'reject');
  });
  await expect(page.getByRole('alert')).toContainText("couldn't load your book lists");
  await expect(page.locator('[data-skeleton="book-list-card"]')).toHaveCount(0);
  await page.evaluate(() => window.libraryTasks!.configure('catalog', 'resolve'));
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.collection-row')).toHaveCount(3);
});
test('empty collections have one create action and a complete first-list flow', async ({ page }) => {
  await page.goto('/lists?noCollections');
  await expect(page.getByRole('heading', { name: 'Create your first list' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create List', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Create List', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Create List', exact: true });
  await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('First collection');
  await editor.getByRole('button', { name: 'Create List', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open First collection' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create List', exact: true })).toBeFocused();
});
test('collection links support a separate tab without replacing the current route', async ({ page, context }) => {
  await open(page, '/lists'); const original = page.url();
  const popup = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Open Weekend reading', exact: true }).click({ modifiers: ['ControlOrMeta'] });
  const other = await popup; await expect(other).toHaveURL(/lists\/list-1$/);
  await expect(other.locator('.collection-book').first()).toBeVisible();
  await expect(page).toHaveURL(original); await other.close();
});
