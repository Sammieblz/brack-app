import { expect, test, type Page, type Locator } from '@playwright/test';
import type {} from '../fixtures/library-tasks/main';
import type {} from '../fixtures/library-renewal/api';
const title = 'The Left Hand of Darkness';
const longTitle = 'The Left Hand of Darkness: A Journey Through Ice, Friendship, and the Stories We Carry Home';
const second = 'A Psalm for the Wild-Built';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const list: string[] = []; errors.set(page, list); page.on('pageerror', error => list.push(error.message)); });
test.afterEach(async ({ page }, info) => {
  await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' });
  expect(errors.get(page)).toEqual([]);
});
async function open(page: Page, view: string, width = 390, query = '', path = '/my-books') {
  await page.setViewportSize({ width, height: width < 768 ? 900 : 1112 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${path}?view=${view}&${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(page.getByRole('button', { name: `Open ${query.includes('long') ? longTitle : title}`, exact: true })).toBeVisible();
}
async function usable(node: Locator) {
  await node.scrollIntoViewIfNeeded();
  await expect.poll(() => node.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return box.width >= 44 && box.height >= 44 && box.left >= -1 && box.right <= innerWidth + 1 &&
      box.top >= -1 && box.bottom <= innerHeight + 1 && (hit === element || element.contains(hit));
  })).toBe(true);
}
async function preview(page: Page, name = title) {
  await page.getByRole('button', { name: `Open ${name}`, exact: true }).press('Enter');
  const dialog = page.getByRole('dialog', { name, exact: true }); await expect(dialog).toBeVisible(); return dialog;
}
for (const view of ['bookshelf', 'carousel']) {
  for (const profile of [
    { name: 'phone', width: 390, query: '' }, { name: 'tablet', width: 834, query: '' }, { name: 'desktop', width: 1280, query: '' },
    { name: 'compact200', width: 320, query: 'text=200&long' }, { name: 'tablet200', width: 834, query: 'text=200&long' },
    { name: 'dark', width: 834, query: 'theme=dark' }, { name: 'paper', width: 390, query: 'palette=paper-library' },
  ]) {
    test(`composition ${view} ${profile.name}`, async ({ page }, info) => {
      await open(page, view, profile.width, profile.query);
      const fonts = await page.evaluate(async () => { await Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(f => document.fonts.load(`16px "${f}"`))); await document.fonts.ready;
        return ['Inter', 'Merriweather', 'Playfair Display'].map(f => ({ family: f, loaded: [...document.fonts].some(face => face.family.replace(/["']/g, '') === f && face.status === 'loaded') })); });
      for (const font of fonts) expect(font.loaded, font.family).toBe(true);
      await info.attach('fonts', { body: JSON.stringify(fonts), contentType: 'application/json' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (view === 'bookshelf') {
        const count = await page.locator('.library-shelf-books').first().evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
        if (profile.name === 'phone') expect(count).toBe(2);
        if (profile.name === 'compact200') expect(count).toBe(1);
      } else {
        await usable(page.getByRole('combobox', { name: 'Choose a book' }));
        await usable(page.getByRole('button', { name: 'Next slide' }));
        await expect(page.getByRole('button', { name: /^Go to / })).toHaveCount(0);
        if (profile.name === 'tablet') {
          const ratio = await page.locator('.library-carousel-slide').first().evaluate(node => node.getBoundingClientRect().width / node.closest('.library-carousel')!.getBoundingClientRect().width);
          expect(ratio).toBeGreaterThan(.45); expect(ratio).toBeLessThan(.6);
        }
      }
      await info.attach('composition', { body: await page.screenshot(), contentType: 'image/png' });
      const name = profile.query.includes('long') ? longTitle : title;
      const dialog = await preview(page, name);
      const heading = dialog.getByRole('heading', { name, exact: true }).last();
      expect(await heading.evaluate(node => node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await usable(dialog.getByRole('link', { name: 'Log progress', exact: true }));
      await usable(dialog.getByRole('button', { name: `More actions for ${name}`, exact: true }));
      await expect(dialog.getByText('A book to return to, and a place to keep the passages that stay with you.', { exact: true })).not.toBeVisible();
      await info.attach('preview', { body: await page.screenshot(), contentType: 'image/png' });
      await dialog.locator('summary').click();
      await expect(dialog.getByText('A book to return to, and a place to keep the passages that stay with you.', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: `Open ${name}`, exact: true })).toBeFocused();
    });
  }
  test(`${view}: preview DOM, disclosure and focus survive resizing`, async ({ page }) => {
    await open(page, view, 390, 'runtime=android'); const dialog = await preview(page);
    await dialog.locator('summary').click(); await dialog.locator('summary').focus(); const node = await dialog.locator('summary').elementHandle();
    for (const width of [834, 1280, 320, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(dialog.locator('details')).toHaveAttribute('open', ''); await expect(dialog.locator('summary')).toBeFocused();
      expect(await dialog.locator('summary').evaluate((current, original) => current === original, node)).toBe(true);
    }
    await page.evaluate(() => window.libraryTasks!.back()); await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Open ${title}`, exact: true })).toBeFocused();
  });
  test(`${view}: selection toggles once without opening a preview`, async ({ page }) => {
    await open(page, view); await page.getByRole('button', { name: 'Library controls', exact: true }).click();
    await page.getByRole('dialog', { name: 'Library controls' }).getByRole('button', { name: 'Select', exact: true }).click();
    const toggle = page.getByRole('button', { name: `Select ${title}`, exact: true });
    await toggle.press('Space'); await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('1 book selected', { exact: true })).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await toggle.press('Enter'); await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  });
}
for (const path of ['/my-books', '/books']) test(`carousel: real BookDetail return retains selected book ${path}`, async ({ page }) => {
  await open(page, 'carousel', 390, '', path);
  await page.getByRole('combobox', { name: 'Choose a book' }).selectOption('book-2');
  const url = page.url(); const dialog = await preview(page, second);
  await dialog.getByRole('button', { name: `More actions for ${second}`, exact: true }).click();
  await dialog.getByRole('button', { name: 'View details', exact: true }).click(); await expect(page).toHaveURL(/\/book\/book-2$/);
  await page.getByRole('button', { name: 'Go back', exact: true }).click(); await expect(page).toHaveURL(url);
  await expect(page.getByRole('combobox', { name: 'Choose a book' })).toHaveValue('book-2');
  await expect(page.locator('.library-carousel-card[aria-current="true"]')).toHaveAttribute('data-library-book-id', 'book-2');
});
test('carousel: bounded navigation, final book and account-scoped context', async ({ page }) => {
  await open(page, 'carousel', 834, 'manyBooks');
  await expect(page.locator('.library-carousel-navigation button')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Choose a book' }).selectOption('book-30');
  await expect(page.getByRole('button', { name: 'Next slide' })).toBeDisabled();
  await expect(page.locator('.library-carousel-card[aria-current="true"]')).toHaveAttribute('data-library-book-id', 'book-30');
  await page.getByRole('button', { name: 'Previous slide' }).press('Enter');
  await expect(page.getByRole('combobox', { name: 'Choose a book' })).toHaveValue('book-29');
  await page.evaluate(() => window.libraryTasks!.setAccount('other-reader'));
  await expect(page.getByRole('combobox', { name: 'Choose a book' })).toHaveValue('book-1');
});
async function reorder(page: Page) {
  await open(page, 'bookshelf'); await page.getByRole('button', { name: 'Library controls', exact: true }).click();
  await page.getByRole('dialog', { name: 'Library controls' }).getByRole('button', { name: 'Reorder', exact: true }).click();
}
test('shelf: visible move serializes saves, rolls back failure and retries across row boundaries', async ({ page }) => {
  await reorder(page);
  await page.evaluate(() => window.libraryTasks!.configure('shelf-reorder', 'defer'));
  const move = page.getByRole('button', { name: `Move ${second} later`, exact: true }); await usable(move); await move.click();
  await expect(move).toBeFocused(); await expect(move).toHaveAttribute('aria-disabled', 'true'); await move.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Saving shelf order' })).toBeVisible();
  expect(await page.evaluate(() => window.libraryTasks!.snapshot().calls.filter(call => call.operation === 'shelf-reorder').length)).toBe(1);
  await page.evaluate(() => window.libraryTasks!.settle('shelf-reorder', 'reject'));
  await expect(page.getByRole('alert')).toContainText("Couldn't save shelf order");
  await expect(page.locator('.library-shelf-title').nth(1)).toHaveText(second); await expect(move).toBeFocused();
  await page.evaluate(() => window.libraryTasks!.configure('shelf-reorder', 'resolve'));
  await move.click(); await expect(page.getByText('Shelf order updated', { exact: true })).toBeVisible();
  await expect(page.locator('.library-shelf-title').nth(2)).toHaveText(second);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: `Open ${second}`, exact: true })).toBeVisible();
});
test('shelf: late failed reorder cannot change a replacement account', async ({ page }) => {
  await reorder(page); await page.evaluate(() => window.libraryTasks!.configure('shelf-reorder', 'defer'));
  await page.getByRole('button', { name: `Move ${title} later`, exact: true }).click();
  await page.evaluate(() => window.libraryTasks!.setAccount('replacement-reader'));
  await expect(page.locator('.library-shelf-title').first()).toHaveText(title);
  await page.evaluate(() => window.libraryTasks!.settle('shelf-reorder', 'reject'));
  await expect(page.getByRole('alert')).toHaveCount(0); await expect(page.getByText('Shelf order updated', { exact: true })).toHaveCount(0);
  await expect(page.locator('.library-shelf-title').first()).toHaveText(title);
});
test('shelf: live text resizing reduces density in the same pane', async ({ page }) => {
  await open(page, 'bookshelf', 834);
  const columns = () => page.locator('.library-shelf-books').first().evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  const before = await columns();
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await expect.poll(columns).toBeLessThan(before);
});

test('carousel: current book survives resize and live reduced-motion changes', async ({ page }) => {
  await open(page, 'carousel');
  await page.getByRole('combobox', { name: 'Choose a book' }).selectOption('book-2');
  for (const width of [834, 1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('combobox', { name: 'Choose a book' })).toHaveValue('book-2');
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('combobox', { name: 'Choose a book' })).toHaveValue('book-2');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('combobox', { name: 'Choose a book' })).toHaveValue('book-2');
});

test('shelf: large-text movement alternatives stay reachable', async ({ page }, info) => {
  await open(page, 'bookshelf', 320, 'text=200&long');
  await page.getByRole('button', { name: 'Library controls', exact: true }).click();
  await page.getByRole('dialog', { name: 'Library controls' }).getByRole('button', { name: 'Reorder', exact: true }).click();
  const later = page.getByRole('button', { name: `Move ${longTitle} later`, exact: true });
  await usable(later); await later.click();
  await expect(page.getByText('Shelf order updated', { exact: true })).toBeVisible();
  await expect(later).toBeFocused(); await usable(later);
  await info.attach('large-text-reorder', { body: await page.screenshot(), contentType: 'image/png' });
});
for (const width of [390, 834]) test(`carousel: reading metadata loads without a large layout jump at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/my-books?view=carousel&data=defer');
  const skeleton = page.locator('[data-skeleton="library-carousel"]'); await expect(skeleton).toBeVisible();
  await page.evaluate(async () => { await Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(f => document.fonts.load(`16px "${f}"`))); await document.fonts.ready; });
  const before = (await skeleton.boundingBox())!;
  await page.evaluate(() => window.libraryPresentation.setMode('ready'));
  await expect(page.locator('.library-carousel-card')).toHaveCount(3);
  const after = (await page.locator('.library-carousel').boundingBox())!;
  await test.info().attach('reading-loading-geometry', { body: JSON.stringify({ before, after }), contentType: 'application/json' });
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(48);
});
