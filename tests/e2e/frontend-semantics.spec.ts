import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { renewalFixture } from '../fixtures/frontend-semantics/state';

const errors = new WeakMap<BrowserContext, string[]>();
test.beforeEach(async ({ page, context }) => {
  const observed: string[] = [];
  errors.set(context, observed);
  const observe = (target: Page) => target.on('pageerror', (error) => observed.push(error.message));
  observe(page); context.on('page', observe);
  await context.route('**/*', (route) => new URL(route.request().url()).origin === 'http://127.0.0.1:8087' ? route.continue() : route.abort());
});
test.afterEach(async ({ context }) => { expect(errors.get(context), 'No uncaught browser errors').toEqual([]); });
async function waitForFixtureReady(page: Page) {
  await expect(page.getByText('Frontend semantics fixture', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => Boolean(window.renewalFixture));
}
async function load(page: Page, path: string, width = 390) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(path);
  await waitForFixtureReady(page);
}
const snapshot = (page: Page): Promise<ReturnType<typeof renewalFixture.snapshot>> => page.evaluate(() => window.renewalFixture.snapshot());
async function openNotifications(page: Page) {
  await page.getByRole('button', { name: /^Notifications(,|$)/ }).click();
  const popover = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await expect(popover).toBeVisible();
  return popover;
}
async function resolveNotifications(page: Page) {
  await expect.poll(async () => (await snapshot(page)).pendingFetches).toBeGreaterThan(0);
  await page.evaluate(() => window.renewalFixture.resolveNotifications());
  await expect(page.getByRole('button', { name: 'Notifications, 2 unread', exact: true })).toBeVisible();
}

test.describe('F02 destination semantics', () => {
  test('history progress links support keyboard and a separate browser tab', async ({ page, context }) => {
    await load(page, '/history');
    const link = page.getByRole('link', { name: /Open The fixture reading book, progress log/ });
    await expect(link).toHaveAttribute('href', '/book/fixture-book');
    expect(await link.locator('button,a,input,select,textarea').count()).toBe(0);
    await link.focus(); await link.press('Enter');
    await expect(page.getByTestId('destination')).toHaveText('/book/fixture-book');
    await page.goBack();
    await expect(link).toBeVisible();
    const popupPromise = context.waitForEvent('page');
    await link.click({ modifiers: ['ControlOrMeta'] });
    const popup = await popupPromise;
    await waitForFixtureReady(popup);
    await expect(popup.getByTestId('destination')).toHaveText('/book/fixture-book');
    await expect(page).toHaveURL(/\/history$/);
    await popup.close();
  });

  test('journal selection survives detail navigation, Back and reload', async ({ page }) => {
    await load(page, '/history?keep=1', 834);
    await page.getByRole('tab', { name: /Journal Entries/ }).click();
    await expect(page).toHaveURL(/keep=1.*tab=journals/);
    const link = page.getByRole('link', { name: /Open The fixture reading book, A remembered passage/ });
    await link.focus(); await link.press('Enter');
    await expect(page.getByTestId('destination')).toHaveText('/book/fixture-book');
    await page.goBack();
    await expect(page.getByRole('tab', { name: /Journal Entries/ })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(link).toBeVisible();
  });

  test('profile clubs use canonical links and retain source tab on return', async ({ page }) => {
    await load(page, '/users/fixture-profile?keep=1');
    await page.getByRole('tab', { name: 'Clubs', exact: true }).click();
    const club = page.getByRole('link', { name: 'Open Quiet Readers', exact: true });
    await expect(club).toHaveAttribute('href', '/clubs/fixture-club');
    expect(await club.locator('button,a,input,select,textarea').count()).toBe(0);
    await club.focus(); await club.press('Enter');
    await expect(page.getByTestId('destination')).toHaveText('/clubs/fixture-club');
    await page.goBack();
    await expect(page).toHaveURL(/keep=1.*tab=clubs/);
    await expect(page.getByRole('tab', { name: 'Clubs', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.reload(); await expect(club).toBeVisible();
  });

  test('shared profile books are semantic links on a wide viewport', async ({ page }) => {
    await load(page, '/users/fixture-profile', 1280);
    const link = page.getByRole('link', { name: 'Open The fixture reading book', exact: true });
    await expect(link).toHaveAttribute('href', '/book/fixture-book');
    await link.focus(); await link.press('Enter');
    await expect(page.getByTestId('destination')).toHaveText('/book/fixture-book');
  });

  test('canonical club routes retain the real social feature gate', async ({ page }) => {
    await load(page, '/clubs/fixture-club');
    await expect(page.getByTestId('destination')).toHaveText('/clubs/fixture-club');
    await load(page, '/clubs/fixture-club?social=off');
    await expect(page.getByTestId('destination')).toHaveText('/dashboard');
    await load(page, '/users/fixture-profile?social=off');
    await expect(page.getByTestId('destination')).toHaveText('/dashboard');
  });

  test('direct 404 offers signed-in app recovery without reloading', async ({ page }) => {
    await load(page, '/missing');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go back', exact: true })).toHaveCount(0);
    const handle = await page.evaluateHandle(() => window.renewalFixture);
    await page.getByRole('link', { name: 'Go to my library' }).click();
    await expect(page.getByTestId('destination')).toHaveText('/my-books');
    expect(await page.evaluate((original) => original === window.renewalFixture, handle)).toBe(true);
  });

  test('signed-out 404 has public home recovery', async ({ page }) => {
    await load(page, '/missing?anonymous=1');
    await page.getByRole('link', { name: 'Go home', exact: true }).click();
    await expect(page.getByTestId('destination')).toHaveText('/');
  });

  test('404 returns within app history and rechecks its safe fallback', async ({ page }) => {
    await load(page, '/history');
    await page.getByRole('link', { name: 'Missing page fixture' }).click();
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
    await page.getByRole('link', { name: 'Missing page fixture' }).click();
    await page.evaluate(() => window.history.replaceState({ ...window.history.state, idx: 0 }, ''));
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(page.getByTestId('destination')).toHaveText('/my-books');
  });

  test('direct history tab replacement does not create unsafe back history', async ({ page }) => {
    await load(page, '/history', 1280);
    await page.getByRole('tab', { name: /Journal Entries/ }).click();
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(page.getByTestId('destination')).toHaveText('/analytics');
  });
});

test.describe('F03 notification states', () => {
  test('loading and failed fetch never look empty; retry can establish true empty', async ({ page }) => {
    await load(page, '/');
    const popover = await openNotifications(page);
    await expect(popover.getByText("You're caught up", { exact: true })).toHaveCount(0);
    await page.evaluate(() => window.renewalFixture.rejectNotifications());
    await expect(popover.getByText('Notifications could not be loaded.', { exact: true })).toBeVisible();
    await expect(popover.getByText("You're caught up", { exact: true })).toHaveCount(0);
    await popover.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).pendingFetches).toBe(1);
    await page.evaluate(() => window.renewalFixture.resolveNotifications([]));
    await expect(popover.getByText("You're caught up", { exact: true })).toBeVisible();
  });

  test('cached rows remain readable on refresh failure', async ({ page }) => {
    await load(page, '/', 834); await resolveNotifications(page);
    const popover = await openNotifications(page);
    await popover.getByRole('button', { name: 'Refresh notifications' }).click();
    await expect(popover.getByRole('button', { name: /A reading milestone/ })).toBeVisible();
    await page.evaluate(() => window.renewalFixture.rejectNotifications());
    await expect(popover.getByText('Notifications could not be refreshed. Your previous updates are still here.')).toBeVisible();
    await expect(popover.getByRole('button', { name: /A reading milestone/ })).toBeVisible();
    await expect(popover.getByText("You're caught up", { exact: true })).toHaveCount(0);
  });

  test('row opens immediately even when marking read fails and can retry', async ({ page }) => {
    await load(page, '/'); await resolveNotifications(page);
    let popover = await openNotifications(page);
    await popover.getByRole('button', { name: /A reading milestone/ }).click();
    await expect(page.getByTestId('destination')).toHaveText('/achievements?tab=quests');
    await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toHaveCount(0);
    await expect.poll(async () => (await snapshot(page)).markCalls.length).toBe(1);
    await page.evaluate(() => window.renewalFixture.rejectMark());
    await expect(page.getByRole('button', { name: 'Notifications, 2 unread', exact: true })).toBeVisible();
    popover = await openNotifications(page);
    await expect(popover.getByText("Could not confirm this notification's read status. Try again.")).toBeVisible();
    await popover.getByRole('button', { name: 'Retry marking read' }).click();
    await expect.poll(async () => (await snapshot(page)).markCalls.length).toBe(2);
    await page.evaluate(() => window.renewalFixture.resolveMark());
    await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
    await expect(popover.getByText('Read status updated.', { exact: true })).toBeVisible();
  });

  test('mark all read locks repeated submission and keeps unread on failure', async ({ page }) => {
    await load(page, '/'); await resolveNotifications(page);
    const popover = await openNotifications(page);
    await popover.getByRole('button', { name: 'Mark all read', exact: true }).dblclick({ delay: 10 });
    await expect.poll(async () => (await snapshot(page)).markCalls.length).toBe(1);
    await expect(popover.getByRole('button', { name: 'Marking all read…', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Notifications, 2 unread', exact: true })).toBeVisible();
    await page.evaluate(() => window.renewalFixture.rejectMark());
    await expect(popover.getByText("Could not confirm the notifications' read status. Try again.")).toBeVisible();
    await popover.getByRole('button', { name: 'Retry marking read' }).click();
    await page.evaluate(() => window.renewalFixture.resolveMark());
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
  });

  test('explicit close and Escape restore focus to the trigger', async ({ page }) => {
    await load(page, '/'); await resolveNotifications(page);
    const trigger = page.getByRole('button', { name: 'Notifications, 2 unread', exact: true });
    const popover = page.getByRole('dialog', { name: 'Notifications', exact: true });
    const close = popover.getByRole('button', { name: 'Close notifications', exact: true });
    await trigger.focus(); await trigger.press('Enter');
    await expect(popover).toBeVisible();
    await expect(close).toBeFocused();
    await close.click();
    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.press('Enter');
    await expect(popover).toBeVisible();
    await expect(close).toBeFocused();
    await close.press('Escape');
    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('account switching hides previous rows and late read outcomes', async ({ page }) => {
    await load(page, '/'); await resolveNotifications(page);
    const popover = await openNotifications(page);
    await popover.getByRole('button', { name: 'Mark all read', exact: true }).click();
    await page.evaluate(() => window.renewalFixture.setReader('other-reader'));
    await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toHaveCount(0);
    await page.evaluate(() => window.renewalFixture.rejectMark());
    const reopened = await openNotifications(page);
    await expect(reopened.getByRole('button', { name: /A reading milestone/ })).toHaveCount(0);
    await expect(reopened.getByText("Could not confirm the notifications' read status. Try again.")).toHaveCount(0);
    await page.evaluate(() => window.renewalFixture.resolveNotifications([]));
    await expect(reopened.getByText("You're caught up", { exact: true })).toBeVisible();
  });

  test('notification destination still applies the gamification feature gate', async ({ page }) => {
    await load(page, '/?journey=off'); await resolveNotifications(page);
    const popover = await openNotifications(page);
    await popover.getByRole('button', { name: /A new reading badge/ }).click();
    await expect(page.getByTestId('destination')).toHaveText('/dashboard');
  });

  test('pending read ownership survives a header remount without duplicate mutation', async ({ page }) => {
    await load(page, '/'); await resolveNotifications(page);
    let popover = await openNotifications(page);
    await popover.getByRole('button', { name: 'Mark all read', exact: true }).click();
    await page.evaluate(() => window.renewalFixture.remountHeader());
    popover = await openNotifications(page);
    await expect(popover.getByRole('button', { name: 'Marking all read…', exact: true })).toBeDisabled();
    expect((await snapshot(page)).markCalls).toHaveLength(1);
    await page.evaluate(() => window.renewalFixture.rejectMark());
    await expect(popover.getByRole('button', { name: 'Retry marking read' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notifications, 2 unread', exact: true })).toBeVisible();
  });

  test('mark-all confirmation does not clear notifications arriving during the request', async ({ page }) => {
    await load(page, '/'); await resolveNotifications(page);
    const popover = await openNotifications(page);
    await popover.getByRole('button', { name: 'Mark all read', exact: true }).click();
    await popover.getByRole('button', { name: 'Refresh notifications' }).click();
    await page.evaluate(() => {
      const rows = window.renewalFixture.notificationRows();
      rows.push({ ...rows[0], id: 'new-during-mark', title: 'New while marking', body: 'Arrived later' });
      window.renewalFixture.resolveNotifications(rows);
    });
    await expect(page.getByRole('button', { name: 'Notifications, 3 unread', exact: true })).toBeVisible();
    await page.evaluate(() => window.renewalFixture.resolveMark());
    await expect(page.getByRole('button', { name: 'Notifications, 1 unread', exact: true })).toBeVisible();
    await expect(popover.getByRole('button', { name: /New while marking Unread/ })).toBeVisible();
  });

  test('a confirming refresh clears obsolete mutation failure feedback', async ({ page }) => {
    await load(page, '/'); await resolveNotifications(page);
    const popover = await openNotifications(page);
    await popover.getByRole('button', { name: 'Mark all read', exact: true }).click();
    await page.evaluate(() => window.renewalFixture.rejectMark());
    await expect(popover.getByRole('button', { name: 'Retry marking read' })).toBeVisible();
    await popover.getByRole('button', { name: 'Refresh notifications' }).click();
    await page.evaluate(() => window.renewalFixture.resolveNotifications(window.renewalFixture.notificationRows().map((row) => ({ ...row, read_at: '2026-09-27T13:00:00Z' }))));
    await expect(popover.getByRole('button', { name: 'Retry marking read' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
  });
});

test.describe('F03 writing semantics', () => {
  test('review validation labels, describes and focuses the actual rich-text input', async ({ page }) => {
    await load(page, '/editors', 834);
    await page.getByRole('button', { name: 'Write fixture review' }).click();
    const dialog = page.getByRole('dialog', { name: 'Write a Review' });
    const rating = dialog.getByRole('radio', { name: '4 stars', exact: true });
    await rating.focus(); await rating.press('Space');
    await expect(rating).toBeChecked();
    await dialog.getByRole('textbox', { name: 'Review Title (Optional)', exact: true }).fill('A short review');
    const editor = dialog.getByRole('textbox', { name: 'Review *', exact: true });
    await expect(editor).toHaveAttribute('aria-multiline', 'true');
    await expect(editor).toHaveAccessibleDescription(/Minimum 10 characters/);
    await editor.fill('Short');
    await dialog.getByRole('button', { name: 'Submit Review', exact: true }).click();
    await expect(editor).toHaveAttribute('aria-invalid', 'true');
    await expect(editor).toHaveAccessibleDescription(/Review must be at least 10 characters/);
    await expect(editor).toBeFocused();
    await editor.fill('A thoughtful review of this fixture book.');
    await expect(editor).toHaveAttribute('aria-invalid', 'false');
    await expect(dialog.getByRole('switch', { name: 'Contains Spoilers', exact: true })).toBeVisible();
    await expect(dialog.getByRole('switch', { name: 'Public Review', exact: true })).toBeVisible();
  });

  test('formatting exposes pressed state and link input has a persistent label', async ({ page }) => {
    await load(page, '/editors', 1280);
    await page.getByRole('button', { name: 'Write fixture review' }).click();
    const dialog = page.getByRole('dialog', { name: 'Write a Review' });
    const editor = dialog.getByRole('textbox', { name: 'Review *', exact: true });
    await editor.fill('A passage with a link.'); await editor.press('ControlOrMeta+a');
    const bold = dialog.getByRole('button', { name: 'Bold', exact: true });
    await bold.click(); await expect(bold).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Add link', exact: true }).click();
    const url = page.getByRole('textbox', { name: 'Link URL', exact: true });
    await expect(url).toBeVisible(); await url.fill('https://example.invalid/reading');
    await expect(url).toHaveAccessibleName('Link URL');
  });
});
