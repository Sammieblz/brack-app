import { expect, test, type Page } from '@playwright/test';
import type {} from '../fixtures/reading-session/main';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const value: string[] = []; errors.set(page, value); page.on('pageerror', error => value.push(error.message)); });
test.afterEach(async ({ page }, info) => { await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' }); expect(errors.get(page)).toEqual([]); });
async function fonts(page: Page) {
  expect(await page.evaluate(async () => {
    const families = ['Inter', 'Merriweather', 'Playfair Display'];
    await Promise.all(families.map(family => document.fonts.load(`16px "${family}"`))); await document.fonts.ready;
    return families.every(family => [...document.fonts].some(face => face.family.replace(/["']/g, '') === family && face.status === 'loaded'));
  })).toBe(true);
}
for (const width of [390, 834]) for (const surface of ['active', 'picker', 'empty-picker', 'recovery', 'edit'] as const) {
  test(`baseline ${surface} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1112 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const target = surface === 'edit' ? '/edit-book/book-1?populated' : surface === 'picker' || surface === 'empty-picker'
      ? `/my-books?populated&${surface === 'empty-picker' ? 'emptyPicker' : ''}`
      : `/book/book-1?populated&timer=${surface === 'recovery' ? 'stale' : 'running'}`;
    await page.goto(target); await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
    if (surface === 'active') { await page.getByRole('button', { name: 'Open timer details', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Reading session', exact: true })).toBeVisible(); }
    if (surface === 'picker' || surface === 'empty-picker') {
      if (width < 768) {
        await page.getByRole('button', { name: 'Quick actions', exact: true }).click();
        await page.getByRole('button', { name: 'Start Reading Timer', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Start reading timer', exact: true })).toBeVisible();
        if (surface === 'empty-picker') await expect(page.getByText('No books currently being read', { exact: true })).toBeVisible();
      } else {
        await page.getByRole('button', { name: 'Start reading timer', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Start Reading Timer', exact: true })).toBeVisible();
        if (surface === 'empty-picker') await expect(page.getByText('No reading books', { exact: true })).toBeVisible();
      }
    }
    if (surface === 'recovery') await expect(page.getByRole('dialog', { name: 'Review old timer', exact: true })).toBeVisible();
    if (surface === 'edit') await expect(page.getByLabel(/^Title/)).toBeVisible();
    await fonts(page); await info.attach(`${surface}-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}
