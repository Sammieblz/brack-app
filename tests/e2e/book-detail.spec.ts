import { expect, test, type Page } from '@playwright/test';
import type {} from '../fixtures/library-tasks/main';
import type {} from '../fixtures/book-detail/api';
import type {} from '../fixtures/book-detail/timer';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const list: string[] = []; errors.set(page, list); page.on('pageerror', error => list.push(error.message)); });
test.afterEach(async ({ page }, info) => {
  await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' });
  expect(errors.get(page)).toEqual([]);
});
const title = 'The Left Hand of Darkness';
const profiles = [
  { name: 'phone', width: 390, height: 844, query: '' },
  { name: 'tablet', width: 834, height: 1112, query: '' },
  { name: 'desktop', width: 1440, height: 1000, query: '' },
  { name: 'compact200', width: 320, height: 900, query: 'text=200&long' },
  { name: 'dark', width: 834, height: 1112, query: 'theme=dark' },
  { name: 'paper', width: 390, height: 844, query: 'palette=paper-library' },
  { name: 'phone320', width: 320, height: 740, query: '' },
  { name: 'tablet200', width: 834, height: 1112, query: 'text=200&long' },
  { name: 'landscape', width: 844, height: 390, query: '' },
  { name: 'android', width: 390, height: 844, query: 'runtime=android' },
];
async function open(page: Page, query = '', width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/book/book-1?${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
}
async function fonts(page: Page) {
  const ready = await page.evaluate(async () => {
    const families = ['Inter', 'Merriweather', 'Playfair Display'];
    await Promise.all(families.map(f => document.fonts.load(`16px "${f}"`))); await document.fonts.ready;
    return families.every(f => [...document.fonts].some(face => face.family.replace(/["']/g, '') === f && face.status === 'loaded'));
  });
  expect(ready).toBe(true);
}
for (const profile of profiles) test(`composition ${profile.name}`, async ({ page }, info) => {
  await open(page, profile.query, profile.width, profile.height); await fonts(page);
  await info.attach('composition', { body: await page.screenshot(), contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const reading = page.getByRole('button', { name: 'Start reading', exact: true });
  const log = page.getByRole('button', { name: 'Log progress', exact: true });
  const contrast = await reading.evaluate(node => {
    const css = getComputedStyle(node);
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const a = luminance(css.color), b = luminance(css.backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  expect(await reading.evaluate(node => !!(node.compareDocumentPosition(document.querySelector('[role=tablist]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  if (profile.name === 'phone' || profile.name === 'phone320' || profile.name === 'android') {
    expect((await log.boundingBox())!.y + (await log.boundingBox())!.height).toBeLessThan(profile.height - 80);
  }
  for (const button of [reading, log, page.getByRole('button', { name: /^More actions for/ }), ...await page.getByRole('tab').all()]) {
    await button.scrollIntoViewIfNeeded();
    const bounds = (await button.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(profile.width);
    expect(await button.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
  await log.scrollIntoViewIfNeeded();
  await info.attach('reading-controls', { body: await page.screenshot(), contentType: 'image/png' });
});

test('same-book running and paused controls retain the session', async ({ page }) => {
  await open(page, 'session=running');
  await page.getByRole('button', { name: 'Pause reading', exact: true }).click();
  await page.getByRole('button', { name: 'Resume reading', exact: true }).click();
  const timer = await page.evaluate(() => window.bookDetailTimer());
  expect(timer.calls).toEqual(['pause', 'resume']); expect(timer.state.time).toBe(1325);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('another book keeps the existing replacement choice', async ({ page }) => {
  await open(page, 'session=other');
  await page.getByRole('button', { name: 'Start reading', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Replace running timer?' });
  await confirm.getByRole('button', { name: 'Keep current' }).click();
  expect((await page.evaluate(() => window.bookDetailTimer())).state.bookId).toBe('book-2');
  await page.getByRole('button', { name: 'Start reading', exact: true }).click();
  await confirm.getByRole('button', { name: 'Start new' }).click();
  await expect(page.getByRole('button', { name: 'Pause reading', exact: true })).toBeVisible();
  expect((await page.evaluate(() => window.bookDetailTimer())).calls).toEqual(['start']);
});
test('tabs preserve keyboard access and selected panel through pane changes', async ({ page }) => {
  await open(page);
  const overview = page.getByRole('tab', { name: 'Overview', exact: true }); await overview.focus(); await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Logs', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: 'Logs', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByLabel('Current Page', { exact: true }).fill('53');
  const input = await page.getByLabel('Current Page', { exact: true }).elementHandle();
  for (const width of [834, 1440, 320, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('tab', { name: 'Progress', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Current Page', { exact: true })).toHaveValue('53');
    expect(await page.getByLabel('Current Page', { exact: true }).evaluate((node, original) => node === original, input)).toBe(true);
  }
  await page.getByRole('tab', { name: 'Journal', exact: true }).click(); await expect(page.getByRole('tabpanel', { name: 'Journal' })).toBeVisible();
  await page.getByRole('tab', { name: 'Reviews', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Community Reviews' })).toBeVisible();
});
test('log entry stays mounted across resize and native Back protects its draft', async ({ page }) => {
  await open(page, 'runtime=android');
  await page.getByRole('button', { name: 'Log progress', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Log reading progress', exact: true }); await expect(dialog).toBeVisible();
  await dialog.locator('summary').click();
  const notes = dialog.locator('textarea'); await notes.fill('A passage to remember'); const original = await notes.elementHandle();
  for (const width of [834, 1440, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await expect(notes).toHaveValue('A passage to remember');
    expect(await notes.evaluate((node, before) => node === before, original)).toBe(true);
  }
  await page.evaluate(() => window.libraryTasks!.back());
  await page.getByRole('dialog', { name: 'Discard this progress draft?' }).getByRole('button', { name: 'Discard draft' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Log progress', exact: true })).toBeFocused();
  // F11b adds the guard; this regression retains the actual F11a opener and owner check.
});
test('More preserves membership task and returns focus across resize', async ({ page }) => {
  await open(page, 'runtime=android');
  await expect(page.getByRole('button', { name: 'Edit book', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^More actions for/ }).click();
  const trigger = page.getByRole('button', { name: 'Add to list', exact: true }); await trigger.click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 834, height: 1112 }); await expect(dialog).toBeVisible();
  await page.evaluate(() => window.libraryTasks!.back()); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await expect(page.getByRole('button', { name: /^More actions for/ })).toHaveAttribute('aria-expanded', 'true');
});
test('delete waits, preserves failure and retries once', async ({ page }) => {
  await open(page, 'runtime=android'); await page.getByRole('button', { name: /^More actions for/ }).click();
  await page.getByRole('button', { name: 'Delete book', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete this book?' });
  await page.evaluate(() => window.libraryTasks!.configure('book-delete', 'defer'));
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Removing' })).toBeDisabled();
  await page.keyboard.press('Escape'); await page.evaluate(() => window.libraryTasks!.back()); await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 834, height: 1112 }); await expect(dialog).toBeVisible();
  await page.evaluate(() => window.libraryTasks!.settle('book-delete', 'reject'));
  await expect(dialog.getByRole('alert')).toContainText("Couldn't delete");
  await page.evaluate(() => window.libraryTasks!.configure('book-delete', 'resolve'));
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/my-books$/);
  expect((await page.evaluate(() => window.libraryTasks!.snapshot())).calls.filter(call => call.operation === 'book-delete')).toHaveLength(2);
});
test('mark finished explains consequences and retains failure for retry', async ({ page }) => {
  await open(page, 'offline');
  const finish = page.getByRole('button', { name: 'Mark finished', exact: true });
  await finish.click(); const dialog = page.getByRole('dialog', { name: 'Mark this book finished?' });
  await expect(dialog).toContainText('does not log a reading session'); await dialog.getByRole('button', { name: 'Keep reading' }).click();
  expect((await page.evaluate(() => window.bookDetail.snapshot())).statusCalls).toHaveLength(0);
  await page.evaluate(() => window.bookDetail.configureStatus('defer'));
  await finish.click(); await dialog.getByRole('button', { name: 'Mark finished', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving...', exact: true })).toBeDisabled();
  await page.evaluate(() => window.bookDetail.settleStatus('reject'));
  await expect(page.getByRole('status').filter({ hasText: "Couldn't mark" })).toBeVisible();
  await page.evaluate(() => window.bookDetail.configureStatus('resolve'));
  await finish.click(); await dialog.getByRole('button', { name: 'Mark finished', exact: true }).click();
  await expect(page.getByText('Marked finished on this device.', { exact: false })).toBeVisible();
  await expect(page.getByText('Page 300 of 300', { exact: true })).toBeVisible(); await expect(finish).toHaveCount(0);
  expect((await page.evaluate(() => window.bookDetail.snapshot())).statusCalls).toHaveLength(2);
});
for (const change of ['route', 'account']) test(`late status response cannot update a replacement ${change}`, async ({ page }) => {
  await open(page); await page.evaluate(() => window.bookDetail.configureStatus('defer'));
  await page.getByRole('button', { name: 'Mark finished', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark finished', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.bookDetail.snapshot().pendingStatus)).toBe(true);
  await page.evaluate(target => target === 'route' ? window.libraryTasks!.navigate('/book/book-2') : window.libraryTasks!.setAccount('second-reader'), change);
  await expect(page.getByRole('button', { name: 'Mark finished', exact: true })).toBeVisible();
  await page.evaluate(() => window.bookDetail.settleStatus('resolve'));
  await expect(page.getByText('Page 42 of 300', { exact: true })).toBeVisible();
  await expect(page.getByText('Marked finished on this device.', { exact: false })).toHaveCount(0);
});
test('unknown totals do not invent percent; completed state remains readable', async ({ page }) => {
  await open(page, 'unknown'); await expect(page.getByRole('progressbar', { name: 'Book progress' })).toHaveCount(0);
  await expect(page.getByText('Total pages not set', { exact: true })).toBeVisible();
  await open(page, 'completed'); await expect(page.getByRole('progressbar', { name: 'Book progress' })).toHaveAttribute('value', '100');
  await expect(page.getByRole('button', { name: 'Mark finished', exact: true })).toHaveCount(0);
});
test('direct-entry Back returns to Library', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page).toHaveURL(/\/my-books$/); await expect(page.getByRole('button', { name: `Open ${title}`, exact: true })).toBeVisible();
});
for (const width of [320, 834, 1440]) test(`loading keeps the reading and content regions ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto('/book/book-1?load=defer');
  const skeleton = page.locator('[data-skeleton=book-detail]'); await expect(skeleton).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const before = await skeleton.locator('.book-detail-content').boundingBox();
  await page.evaluate(() => window.bookDetail.releaseLoad()); await expect(skeleton).toHaveCount(0);
  const after = await page.locator('.book-detail-content').boundingBox();
  await info.attach('loading-geometry', { body: JSON.stringify({ before, after }), contentType: 'application/json' });
  expect(Math.abs(before!.x - after!.x)).toBeLessThan(2); expect(Math.abs(before!.y - after!.y)).toBeLessThan(80);
});
test('populated metadata, reading statistics and logs stay discoverable', async ({ page }, info) => {
  await open(page, 'populated'); await fonts(page);
  await expect(page.locator('.book-reading-cover svg')).toBeVisible();
  await expect(page.getByText('9780441478125', { exact: true })).toBeVisible();
  await expect(page.getByText('Questions about belonging.', { exact: true })).toBeVisible();
  await expect(page.getByText('Revisit', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reading Progress', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Sessions', exact: true })).toBeVisible();
  await expect(page.getByText('Reading Velocity', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Detailed Analytics', exact: true })).toBeVisible();
  await info.attach('populated-progress', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('tab', { name: 'Logs', exact: true }).click();
  await expect(page.getByText('A memorable passage.', { exact: true })).toBeVisible();
  await expect(page.getByText('Page 42', { exact: true })).toBeVisible();
});
