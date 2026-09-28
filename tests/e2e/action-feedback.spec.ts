import { expect, test, type Page } from '@playwright/test';
import type { actionFixture } from '../fixtures/action-feedback/state';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, context }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on('pageerror', (error) => messages.push(error.message));
  await context.route('**/*', (route) => new URL(route.request().url()).origin === 'http://127.0.0.1:8088' ? route.continue() : route.abort());
});
test.afterEach(async ({ page }) => expect(errors.get(page), 'No uncaught browser errors').toEqual([]));
async function load(page: Page, path: string, width = 390) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(path);
  await expect(page.getByText('Action feedback fixture', { exact: true })).toBeVisible();
}
const snapshot = (page: Page): Promise<ReturnType<typeof actionFixture.snapshot>> => page.evaluate(() => window.actionFixture.snapshot());
async function manual(page: Page, path = '/add-book?isbn=9780140328721', width = 390) {
  await load(page, path, width);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A manual fixture book');
}
async function freezeClock(page: Page) {
  await page.clock.pauseAt(new Date('2026-09-27T14:00:00Z'));
}
const clockStart = new Date('2026-09-27T12:00:00Z');
async function pointer(page: Page, type: string, extra: Record<string, unknown> = {}) {
  await page.getByTestId('press-target').dispatchEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 30, clientY: 180, ...extra });
}

test.describe('F04 Add Book feedback', () => {
  test('F07 dirty app Back keeps the manual draft until explicit discard', async ({ page }) => {
    await manual(page);
    await page.getByRole('textbox', { name: 'Author', exact: true }).fill('A. Reader');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    const prompt = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
    await expect(prompt).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(prompt).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('A manual fixture book');
    await expect(page.getByRole('textbox', { name: 'Author', exact: true })).toHaveValue('A. Reader');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByTestId('destination')).toHaveText('/my-books:');
    expect((await snapshot(page)).creates).toHaveLength(0);
  });

  test('F07 pending app Back waits for the write and rejected draft remains guarded', async ({ page }) => {
    await manual(page);
    await page.getByRole('button', { name: 'Save Book', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).pending).toBe(1);
    // The actual header remains enabled; app Back must consume the request.
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/\/add-book/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await snapshot(page)).creates).toHaveLength(1);
    await page.evaluate(() => window.actionFixture.rejectCreate());
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('A manual fixture book');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('A manual fixture book');
  });

  for (const delay of [80, 180, 700, 4500]) {
    test(`local create at ${delay}ms navigates without advancing a success timer`, async ({ page }) => {
      await page.clock.install({ time: clockStart });
      await manual(page); await freezeClock(page);
      await page.getByRole('button', { name: 'Save Book', exact: true }).click();
      await expect.poll(async () => (await snapshot(page)).creates.length).toBe(1);
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeDisabled();
      await expect(page.getByRole('tab', { name: 'Search', exact: true })).toBeDisabled();
      await page.clock.runFor(delay);
      expect((await snapshot(page)).pending).toBe(1);
      await page.evaluate(() => window.actionFixture.resolveCreate());
      await expect(page.getByTestId('destination')).toHaveText('/my-books:created-book');
      expect((await snapshot(page)).ancillaryReads).toBe(0);
      // Destination is already present with the success clock frozen. Sonner
      // schedules rendering separately; let its announcement mount afterwards.
      await page.clock.runFor(100);
      await expect(page.getByText('Saved on this device. It will sync automatically.', { exact: true })).toBeVisible();
    });
  }

  test('rejected write retains draft and locks repeated submission until retry', async ({ page }) => {
    await manual(page, undefined, 834);
    await page.getByRole('textbox', { name: 'Author', exact: true }).fill('A. Reader');
    await page.locator('#add-book-form').evaluate((form) => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect((await snapshot(page)).creates).toHaveLength(1);
    await page.evaluate(() => window.actionFixture.rejectCreate());
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('A manual fixture book');
    await expect(page.getByRole('textbox', { name: 'Author', exact: true })).toHaveValue('A. Reader');
    await expect(page.getByText('Fixture local write failed', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save Book', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).creates.length).toBe(2);
    await page.evaluate(() => window.actionFixture.resolveCreate());
    await expect(page.getByTestId('destination')).toHaveText('/my-books:created-book');
  });

  test('known duplicate opens its book without creating', async ({ page }) => {
    await manual(page, '/add-book?isbn=9780140328721&duplicate=1');
    await page.getByRole('button', { name: 'Save Book', exact: true }).click();
    await expect(page.getByTestId('destination')).toHaveText('/book/existing-book:');
    expect((await snapshot(page)).creates).toHaveLength(0);
  });

  test('search quick-add completes through the same immediate boundary', async ({ page }) => {
    await page.clock.install({ time: clockStart });
    await load(page, '/add-book?search=fixture', 1280);
    await expect(page.getByText('A searched book', { exact: true })).toBeVisible();
    await freezeClock(page);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).creates.length).toBe(1);
    await expect(page.getByRole('tab', { name: 'Manual', exact: true })).toBeDisabled();
    await page.evaluate(() => window.actionFixture.resolveCreate());
    await expect(page.getByTestId('destination')).toHaveText('/my-books:created-book');
  });

  test('leaving a pending create prevents late navigation and success feedback', async ({ page }) => {
    await manual(page);
    await page.getByRole('button', { name: 'Save Book', exact: true }).click();
    await page.getByRole('link', { name: 'Leave fixture' }).click();
    await expect(page.getByTestId('destination')).toHaveText('/elsewhere:');
    await page.evaluate(() => window.actionFixture.resolveCreate());
    await expect(page.getByTestId('destination')).toHaveText('/elsewhere:');
    await expect(page.getByText('A manual fixture book added to your library', { exact: true })).toHaveCount(0);
  });
});

test.describe('F04 haptic and context gestures', () => {
  test('native selection uses a selection lifecycle, not heavy impact', async ({ page }) => {
    await load(page, '/gestures?runtime=ios');
    await page.getByRole('button', { name: 'Selection feedback' }).click();
    await expect.poll(async () => (await snapshot(page)).haptics.map((entry) => entry.method)).toEqual(['selectionStart', 'selectionChanged', 'selectionEnd']);
  });

  for (const disabled of ['haptics=off', 'plugin=off']) {
    test(`${disabled} keeps actions working without device feedback`, async ({ page }) => {
      await load(page, `/gestures?runtime=android&${disabled}`);
      await page.getByRole('button', { name: 'Selection feedback' }).click();
      await page.getByRole('button', { name: 'More actions for Fixture book' }).click();
      await page.getByRole('button', { name: 'Read fixture book' }).click();
      await expect(page.getByTestId('actions')).toHaveText('1');
      expect((await snapshot(page)).haptics).toHaveLength(0);
    });
  }

  test('one long press opens once, suppresses its click and restores visible trigger focus', async ({ page }) => {
    await page.clock.install({ time: clockStart });
    await load(page, '/gestures?runtime=android'); await freezeClock(page);
    await pointer(page, 'pointerdown'); await page.clock.runFor(501);
    const dialog = page.getByRole('dialog', { name: 'Fixture book' });
    await expect(dialog).toBeVisible();
    expect((await snapshot(page)).haptics).toEqual([{ method: 'impact', options: { style: 'MEDIUM' } }]);
    await pointer(page, 'pointerup'); await page.getByTestId('press-target').dispatchEvent('click', { detail: 1 });
    await expect(page.getByTestId('clicks')).toHaveText('0');
    // Recognition is proved. Let Radix's deferred focus cleanup and CSS exit
    // finish together instead of pausing one clock while the other runs.
    await page.clock.resume();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'More actions for Fixture book' })).toBeFocused();
    await page.getByTestId('press-target').click();
    await expect(page.getByTestId('clicks')).toHaveText('1');
  });

  for (const interruption of ['move', 'scroll', 'second pointer', 'pointer cancel', 'blur', 'unmount']) {
    test(`${interruption} cancels a candidate without blocking the next action`, async ({ page }) => {
      await page.clock.install({ time: clockStart });
      await load(page, '/gestures?runtime=ios'); await freezeClock(page);
      await pointer(page, 'pointerdown');
      if (interruption === 'move') await pointer(page, 'pointermove', { clientY: 220 });
      else if (interruption === 'scroll') await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
      else if (interruption === 'second pointer') await pointer(page, 'pointerdown', { pointerId: 2, isPrimary: false });
      else if (interruption === 'pointer cancel') await pointer(page, 'pointercancel');
      else if (interruption === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      else await page.getByRole('button', { name: 'Toggle target' }).click();
      await page.clock.runFor(600);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect((await snapshot(page)).haptics).toHaveLength(0);
      if (interruption === 'unmount') await page.getByRole('button', { name: 'Toggle target' }).click();
      else await pointer(page, 'pointerup');
      await page.getByTestId('press-target').click();
      await expect(page.getByTestId('clicks')).toHaveText('1');
    });
  }

  test('keyboard menu opens without pointer feedback and Escape returns focus', async ({ page }) => {
    await load(page, '/gestures?runtime=ios', 834);
    const trigger = page.getByRole('button', { name: 'More actions for Fixture book' });
    await trigger.focus(); await trigger.press('Shift+F10');
    await expect(page.getByRole('dialog', { name: 'Fixture book' })).toBeVisible();
    expect((await snapshot(page)).haptics).toHaveLength(0);
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  });

  test('links and editable fields retain native gesture ownership', async ({ page }) => {
    await page.clock.install({ time: clockStart });
    await load(page, '/gestures?runtime=ios'); await freezeClock(page);
    for (const target of [page.getByTestId('native-link'), page.getByRole('textbox', { name: 'Native field' })]) {
      await target.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0 });
      await page.clock.runFor(600); await target.dispatchEvent('pointerup', { pointerId: 1 });
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect((await snapshot(page)).haptics).toHaveLength(0);
    await page.getByRole('textbox', { name: 'Native field' }).fill('Retained input');
    await expect(page.getByRole('textbox', { name: 'Native field' })).toHaveValue('Retained input');
  });
});
