import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Operation } from '../fixtures/responsive-composers/state';
import type { ResponsiveComposersAPI } from '../fixtures/responsive-composers/main';

type Entry = { name: string; route: string; kind: 'post' | 'club'; trigger: string; title: string; submit: string; pending: string; discard: string; upload: Operation; write: Operation };
const entries: Entry[] = [
  { name: 'Feed post', route: '/feed', kind: 'post', trigger: 'Create post', title: 'Create a Post', submit: 'Publish Post', pending: 'Publishing...', discard: 'Discard post draft?', upload: 'post-upload', write: 'post-create' },
  { name: 'BookClubs club', route: '/clubs', kind: 'club', trigger: 'Create club', title: 'Create Book Club', submit: 'Create Club', pending: 'Creating...', discard: 'Discard this club draft?', upload: 'club-banner', write: 'club-create' },
  { name: 'Readers club', route: '/readers', kind: 'club', trigger: 'Create club', title: 'Create Book Club', submit: 'Create Club', pending: 'Creating...', discard: 'Discard this club draft?', upload: 'club-banner', write: 'club-create' },
];
const image = { name: 'reading-banner.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') };
const title = 'A chapter worth sharing';
const body = 'A thoughtful passage deserves room to breathe.';
const diagnostics = new WeakMap<Page, { errors: string[]; warnings: string[] }>();
test.beforeEach(async ({ page }) => {
  const log = { errors: [] as string[], warnings: [] as string[] };
  diagnostics.set(page, log);
  page.on('pageerror', (error) => log.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') log.warnings.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
test.afterEach(async ({ page }, testInfo) => {
  const log = diagnostics.get(page)!;
  await testInfo.attach('browser-diagnostics', { body: JSON.stringify(log, null, 2), contentType: 'application/json' });
  const requests = await page.evaluate(() => window.responsiveComposers?.snapshot() ?? null).catch(() => null);
  await testInfo.attach('request-evidence', { body: JSON.stringify(requests, null, 2), contentType: 'application/json' });
  expect(log.errors, 'No uncaught renderer errors').toEqual([]);
  expect(log.warnings.filter((warning) => /DialogContent.*(DialogTitle|Description)|Missing.*Description/i.test(warning)), 'Named task and confirmation layers').toEqual([]);
});

async function configure(page: Page, operation: Operation, mode: 'resolve' | 'reject' | 'defer') {
  await page.evaluate(({ operation, mode }) => window.responsiveComposers!.configure(operation, mode), { operation, mode });
}
async function calls(page: Page, operation: Operation) {
  return page.evaluate((operation) => window.responsiveComposers!.snapshot().calls.filter((entry) => entry.operation === operation), operation);
}
async function expectCalls(page: Page, operation: Operation, count: number) {
  await expect.poll(async () => (await calls(page, operation)).length).toBe(count);
}
async function pending(page: Page, operation: Operation) {
  await expect.poll(() => page.evaluate((operation) => window.responsiveComposers!.snapshot().pending.includes(operation), operation)).toBe(true);
}
async function settle(page: Page, operation: Operation, outcome: 'resolve' | 'reject') {
  await pending(page, operation);
  await page.evaluate(({ operation, outcome }) => window.responsiveComposers!.settle(operation, outcome), { operation, outcome });
}
async function back(page: Page) {
  await expect.poll(() => page.evaluate(() => window.responsiveComposers!.native().active)).toBe(1);
  await page.evaluate(() => window.responsiveComposers!.back());
}
async function open(page: Page, entry: Entry, viewport = { width: 390, height: 844 }, query = '') {
  await page.setViewportSize(viewport);
  await page.goto(`${entry.route}?runtime=android${query ? `&${query}` : ''}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  if (entry.route === '/readers') await page.getByRole('tab', { name: 'Book Clubs', exact: true }).click();
  const trigger = page.getByRole('button', { name: entry.trigger, exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: entry.title, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function select(page: Page, dialog: Locator, name: string, option: string) {
  await dialog.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function fill(page: Page, dialog: Locator, entry: Entry, media = true) {
  if (entry.kind === 'post') {
    await dialog.getByRole('textbox', { name: 'Title *', exact: true }).fill(title);
    await dialog.getByRole('textbox', { name: 'Content *', exact: true }).fill(body);
    await select(page, dialog, 'Post Type', 'Book info');
    await select(page, dialog, 'Book', 'Reading collection 1');
    await select(page, dialog, 'Visibility', 'Followers');
    await select(page, dialog, 'Genre/Theme', 'Fiction');
    if (media) await dialog.locator('input[type="file"]').setInputFiles(image);
  } else {
    await dialog.getByRole('textbox', { name: 'Club Name *', exact: true }).fill(title);
    await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(body);
    await dialog.getByRole('textbox', { name: 'Genres', exact: true }).fill('Fiction, Mystery');
    await dialog.getByRole('textbox', { name: 'Tags', exact: true }).fill('Slow reading, Weekends');
    await dialog.getByRole('textbox', { name: 'City', exact: true }).fill('Brooklyn');
    await dialog.getByRole('textbox', { name: 'Country', exact: true }).fill('United States');
    await dialog.getByRole('spinbutton', { name: 'Member limit', exact: true }).fill('24');
    await dialog.getByRole('switch', { name: 'Private Club', exact: true }).click();
    if (media) {
      await dialog.getByLabel('Banner image', { exact: true }).setInputFiles(image);
      await dialog.getByLabel('Profile image', { exact: true }).setInputFiles({ ...image, name: 'reading-avatar.png' });
    }
  }
}
async function expectDraft(dialog: Locator, entry: Entry, media = true) {
  if (entry.kind === 'post') {
    await expect(dialog.getByRole('textbox', { name: 'Title *', exact: true })).toHaveValue(title);
    await expect(dialog.getByRole('textbox', { name: 'Content *', exact: true })).toHaveText(body);
    await expect(dialog.getByRole('combobox', { name: 'Post Type', exact: true })).toHaveText('Book info');
    await expect(dialog.getByRole('combobox', { name: 'Book', exact: true })).toHaveText('Reading collection 1');
    await expect(dialog.getByRole('combobox', { name: 'Visibility', exact: true })).toHaveText('Followers');
    await expect(dialog.getByRole('combobox', { name: 'Genre/Theme', exact: true })).toHaveText('Fiction');
  } else {
    await expect(dialog.getByRole('textbox', { name: 'Club Name *', exact: true })).toHaveValue(title);
    await expect(dialog.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(body);
    for (const [name, value] of [['Genres', 'Fiction, Mystery'], ['Tags', 'Slow reading, Weekends'], ['City', 'Brooklyn'], ['Country', 'United States']]) {
      await expect(dialog.getByRole('textbox', { name, exact: true })).toHaveValue(value);
    }
    await expect(dialog.getByRole('spinbutton', { name: 'Member limit', exact: true })).toHaveValue('24');
    await expect(dialog.getByRole('switch', { name: 'Private Club', exact: true })).toBeChecked();
  }
  if (media) {
    const files = await dialog.locator('input[type="file"]').evaluateAll((inputs) => inputs.map((input) => Array.from((input as HTMLInputElement).files ?? []).map((file) => file.name)));
    expect(files).toEqual(entry.kind === 'post' ? [['reading-banner.png']] : [['reading-banner.png'], ['reading-avatar.png']]);
  }
}
async function expectReset(dialog: Locator, entry: Entry) {
  await expect(dialog.getByRole('textbox', { name: entry.kind === 'post' ? 'Title *' : 'Club Name *', exact: true })).toHaveValue('');
  if (entry.kind === 'post') await expect(dialog.getByRole('textbox', { name: 'Content *', exact: true })).toHaveText('');
  else {
    await expect(dialog.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('');
    await expect(dialog.getByRole('switch', { name: 'Private Club', exact: true })).not.toBeChecked();
  }
  expect(await dialog.locator('input[type="file"]').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).files?.length ?? 0))).toEqual(entry.kind === 'post' ? [0] : [0, 0]);
}
type Dismissal = 'Close' | 'Cancel' | 'Escape' | 'backdrop' | 'app Back';
async function dismiss(page: Page, dialog: Locator, method: Dismissal) {
  if (method === 'Escape') await page.keyboard.press('Escape');
  else if (method === 'backdrop') await page.mouse.click(2, 2);
  else if (method === 'app Back') await back(page);
  else await dialog.getByRole('button', { name: method, exact: true }).click();
}
async function expectPendingGuards(page: Page, dialog: Locator, entry: Entry) {
  await expect(dialog.getByRole('button', { name: entry.pending, exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('textbox', { name: entry.kind === 'post' ? 'Title *' : 'Club Name *', exact: true })).toBeDisabled();
  if (entry.kind === 'post') await expect(dialog.getByRole('textbox', { name: 'Content *', exact: true })).toHaveAttribute('contenteditable', 'false');
  for (const method of ['Close', 'Escape', 'backdrop', 'app Back'] as const) {
    await dismiss(page, dialog, method);
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog', { name: entry.discard, exact: true })).toHaveCount(0);
  }
}

for (const entry of entries) {
  test(`${entry.name}: same task, draft, selection and files survive all responsive headers`, async ({ page }) => {
    const dialog = await open(page, entry);
    await fill(page, dialog, entry);
    const field = dialog.getByRole('textbox', { name: entry.kind === 'post' ? 'Content *' : 'Club Name *', exact: true });
    const oldDialog = await dialog.elementHandle();
    const oldField = await field.elementHandle();
    const oldFiles = await dialog.locator('input[type="file"]').elementHandles();
    await field.focus();
    if (entry.kind === 'post') { await field.press('ControlOrMeta+Home'); await field.press('Shift+ArrowRight'); await field.press('Shift+ArrowRight'); }
    else await field.evaluate((input: HTMLInputElement) => input.setSelectionRange(2, 8));
    const selection = await field.evaluate((element) => element instanceof HTMLInputElement
      ? { start: element.selectionStart, end: element.selectionEnd }
      : { text: window.getSelection()?.toString(), start: window.getSelection()?.anchorOffset, end: window.getSelection()?.focusOffset });
    for (const width of [390, 767, 768, 834, 1024, 1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(dialog).toHaveAttribute('data-presentation', width < 600 ? 'sheet' : 'center');
      expect(await dialog.evaluate((node, original) => node === original, oldDialog)).toBe(true);
      expect(await field.evaluate((node, original) => node === original, oldField)).toBe(true);
      for (const [index, original] of oldFiles.entries()) {
        expect(await dialog.locator('input[type="file"]').nth(index).evaluate((node, previous) => node === previous, original)).toBe(true);
      }
      await expect(field).toBeFocused();
      expect(await field.evaluate((element) => element instanceof HTMLInputElement
        ? { start: element.selectionStart, end: element.selectionEnd }
        : { text: window.getSelection()?.toString(), start: window.getSelection()?.anchorOffset, end: window.getSelection()?.focusOffset })).toEqual(selection);
      await expectDraft(dialog, entry);
    }
    if (entry.kind === 'post') {
      await select(page, dialog, 'Post Type', 'Book club info');
      await select(page, dialog, 'Book Club', 'The Chapter Circle');
      for (const width of [834, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(dialog.getByRole('combobox', { name: 'Book Club', exact: true })).toHaveText('The Chapter Circle');
        expect(await dialog.evaluate((node, original) => node === original, oldDialog)).toBe(true);
      }
    }
    await expectCalls(page, entry.write, 0);
  });

  test(`${entry.name}: dirty dismissal keeps the real task, discard resets and refocuses replacement header`, async ({ page }) => {
    const dialog = await open(page, entry);
    await fill(page, dialog, entry);
    const original = await dialog.elementHandle();
    await page.setViewportSize({ width: 834, height: 1112 });
    for (const method of ['Close', 'Cancel', 'Escape', 'backdrop', 'app Back'] as const) {
      await dismiss(page, dialog, method);
      const confirmation = page.getByRole('dialog', { name: entry.discard, exact: true });
      await expect(confirmation).toBeVisible();
      await expect(confirmation.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
      await confirmation.getByRole('button', { name: 'Keep editing', exact: true }).click();
      await expect(confirmation).toHaveCount(0);
      expect(await dialog.evaluate((node, previous) => node === previous, original)).toBe(true);
      await expectDraft(dialog, entry);
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await dismiss(page, dialog, 'Cancel');
    await page.getByRole('dialog', { name: entry.discard, exact: true }).getByRole('button', { name: 'Discard draft', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const trigger = page.getByRole('button', { name: entry.trigger, exact: true });
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expectReset(dialog, entry);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expectCalls(page, entry.write, 0);
  });

  test(`${entry.name}: upload and write failures preserve draft, block duplicates/dismissal and retry once`, async ({ page }) => {
    const dialog = await open(page, entry);
    await fill(page, dialog, entry);
    await configure(page, entry.upload, 'defer');
    await dialog.getByRole('button', { name: entry.submit, exact: true }).dblclick();
    await pending(page, entry.upload);
    await page.setViewportSize({ width: 834, height: 1112 });
    await expectPendingGuards(page, dialog, entry);
    await expectCalls(page, entry.upload, 1);
    await expectCalls(page, entry.write, 0);
    await settle(page, entry.upload, 'reject');
    await expect(dialog.getByRole('alert')).toContainText(`Fixture ${entry.upload} failed`);
    await expectDraft(dialog, entry);
    await configure(page, entry.upload, 'resolve');
    await configure(page, entry.write, 'defer');
    await dialog.getByRole('button', { name: entry.submit, exact: true }).dblclick();
    await pending(page, entry.write);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expectPendingGuards(page, dialog, entry);
    await expectCalls(page, entry.write, 1);
    await settle(page, entry.write, 'reject');
    await expect(dialog.getByRole('alert')).toContainText(`Fixture ${entry.write} failed`);
    await expectDraft(dialog, entry);
    const uploadCount = (await calls(page, entry.upload)).length;
    await configure(page, entry.write, 'resolve');
    await dialog.getByRole('button', { name: entry.submit, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expectCalls(page, entry.write, 2);
    await expectCalls(page, entry.upload, uploadCount);
    const writes = await calls(page, entry.write);
    expect(writes[0].payload).toEqual(writes[1].payload);
    expect(writes[1].payload).toMatchObject(entry.kind === 'post'
      ? { title, content: body, book_id: 'fixture-book-0', post_type: 'book', visibility: 'followers', genre: 'Fiction' }
      : { name: title, description: body, genres: ['Fiction', 'Mystery'], tags: ['Slow reading', 'Weekends'], city: 'Brooklyn', country: 'United States', member_limit: 24, is_private: true });
    const trigger = page.getByRole('button', { name: entry.trigger, exact: true });
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expectReset(dialog, entry);
  });

  for (const replacement of ['account', 'route'] as const) {
    test(`${entry.name}: ${replacement} abandonment cannot publish after an old upload completes`, async ({ page }) => {
      const dialog = await open(page, entry);
      await fill(page, dialog, entry);
      await configure(page, entry.upload, 'defer');
      await dialog.getByRole('button', { name: entry.submit, exact: true }).click();
      await pending(page, entry.upload);
      if (replacement === 'account') await page.evaluate(() => window.responsiveComposers!.setAccount('another-reader'));
      else await page.evaluate(() => window.responsiveComposers!.navigate('/fixture-destination?runtime=android'));
      await expect(dialog).toHaveCount(0);
      await settle(page, entry.upload, 'resolve');
      await expectCalls(page, entry.write, 0);
      await expect(page.getByText(entry.kind === 'post' ? 'Post published' : 'Book club created', { exact: true })).toHaveCount(0);
      if (replacement === 'account') {
        await page.getByRole('button', { name: entry.trigger, exact: true }).click();
        await expectReset(dialog, entry);
      }
    });
  }
}

for (const entry of entries.filter((item) => item.kind === 'club')) {
  test(`${entry.name}: confirmed creation closes before list refresh and survives refresh rejection`, async ({ page }) => {
    const dialog = await open(page, entry);
    await fill(page, dialog, entry, false);
    await configure(page, 'clubs-read', 'defer');
    await dialog.getByRole('button', { name: entry.submit, exact: true }).click();
    await expectCalls(page, 'club-create', 1);
    await pending(page, 'clubs-read');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Book club created', { exact: true })).toHaveCount(1);
    await settle(page, 'clubs-read', 'reject');
    await expect(page.getByText('Failed to create book club', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: entry.trigger, exact: true })).toBeFocused();
  });
}

test('Feed post: nested select and link tasks own Back/Escape across a header replacement', async ({ page }) => {
  const entry = entries[0];
  const dialog = await open(page, entry);
  await fill(page, dialog, entry, false);
  const visibility = dialog.getByRole('combobox', { name: 'Visibility', exact: true });
  await visibility.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.setViewportSize({ width: 834, height: 1112 });
  // Radix Select intentionally dismisses its menu on window resize. The task
  // and its chosen value must survive; reopen the menu to test its Back owner.
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: entry.discard, exact: true })).toHaveCount(0);
  await expect(visibility).toHaveText('Followers');
  await visibility.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await back(page);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(visibility).toBeFocused();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog', { name: entry.discard, exact: true })).toHaveCount(0);
  const editor = dialog.getByRole('textbox', { name: 'Content *', exact: true });
  await editor.focus(); await editor.press('ControlOrMeta+a');
  await dialog.getByRole('button', { name: 'Add link', exact: true }).click();
  const url = page.getByRole('textbox', { name: 'Link URL', exact: true });
  await url.fill('https://example.com/reading');
  const original = await url.elementHandle();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await url.evaluate((node, previous) => node === previous, original)).toBe(true);
  await expect(url).toHaveValue('https://example.com/reading');
  await page.keyboard.press('Escape');
  await expect(url).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Add link', exact: true })).toBeFocused();
  await expect(page.getByRole('dialog', { name: entry.discard, exact: true })).toHaveCount(0);
  await expectDraft(dialog, entry, false);
});

for (const [name, viewport, query] of [
  ['large-text', { width: 390, height: 844 }, 'text=200'],
  ['short-height', { width: 390, height: 480 }, ''],
] as const) {
  test(`Feed post: genre selector first and last options remain reachable at ${name}`, async ({ page }) => {
    const dialog = await open(page, entries[0], viewport, query);
    await dialog.getByRole('textbox', { name: 'Title *', exact: true }).fill(title);
    await dialog.getByRole('textbox', { name: 'Content *', exact: true }).fill(body);
    await page.evaluate(() => document.fonts.ready);
    const genre = dialog.getByRole('combobox', { name: 'Genre/Theme', exact: true });
    await genre.click();
    const menu = page.getByRole('listbox');
    await expect(menu).toBeInViewport({ ratio: 1 });
    expect(await menu.evaluate((element) => element.scrollWidth - element.clientWidth), 'Selector must stay inside its available width').toBeLessThanOrEqual(1);
    const last = page.getByRole('option').last();
    const lastName = await last.innerText();
    await wheelToOption(page, menu, last, 1);
    await usable(last);
    await last.click();
    await expect(genre).toHaveText(lastName);
    await genre.click();
    await expect(menu).toBeInViewport({ ratio: 1 });
    const first = page.getByRole('option', { name: 'No genre', exact: true });
    await wheelToOption(page, menu, first, -1);
    await usable(first);
    await first.click();
    await expect(genre).toHaveText('No genre');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Content *', exact: true })).toHaveText(body);
    await expect(page.getByRole('dialog', { name: entries[0].discard, exact: true })).toHaveCount(0);
  });
}

for (const [name, viewport, query] of [
  ['narrow', { width: 320, height: 844 }, ''],
  ['tablet', { width: 834, height: 1112 }, ''],
  ['tablet-large-text', { width: 834, height: 1112 }, 'text=200'],
  ['tablet-touch-large-text', { width: 834, height: 1112 }, 'text=200'],
  ['large-text', { width: 390, height: 844 }, 'text=200'],
  ['short-height', { width: 390, height: 480 }, ''],
] as const) {
  test(`actual responsive task screenshots: ${name}`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    if (name === 'tablet-touch-large-text') await coarsePointer(page);
    const fontEvidence: unknown[] = [];
    for (const entry of entries) {
      const dialog = await open(page, entry, viewport, query);
      await expect(dialog).toHaveAttribute('data-presentation', name === 'tablet-touch-large-text' || viewport.width < 600 ? 'sheet' : 'center');
      await fill(page, dialog, entry);
      const fonts = await page.evaluate(async (entry) => {
        const requested = await Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(async (family) => {
          const faces = await document.fonts.load(`16px "${family}"`);
          return { family, loaded: faces.filter((face) => face.status === 'loaded').length };
        }));
        await document.fonts.ready;
        return { entry, requested, faces: Array.from(document.fonts).map((face) => ({ family: face.family, status: face.status })),
          declaredFamily: getComputedStyle(document.body).fontFamily };
      }, entry.name);
      fontEvidence.push(fonts);
      await testInfo.attach(`${name}-${entry.name}-font-evidence`, { body: JSON.stringify(fonts, null, 2), contentType: 'application/json' });
      for (const face of fonts.requested) expect(face.loaded, `${face.family} must have a loaded declared font face`).toBeGreaterThan(0);
      expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth), 'Dialog content must not overflow horizontally').toBeLessThanOrEqual(1);
      const primary = dialog.getByRole('textbox', { name: entry.kind === 'post' ? 'Content *' : 'Description', exact: true });
      await reveal(primary);
      await usable(primary);
      const bounds = await primary.boundingBox();
      expect(bounds!.width, 'The writing field must retain a usable line length').toBeGreaterThanOrEqual(180);
      const writingPath = testInfo.outputPath(`${name}-${entry.name.replace(/ /g, '-')}-writing.png`);
      await page.screenshot({ fullPage: true, path: writingPath });
      await testInfo.attach(`${name}-${entry.name}-writing`, { path: writingPath, contentType: 'image/png' });
      for (const control of [dialog.getByRole('button', { name: entry.submit, exact: true }), dialog.getByRole('button', { name: 'Cancel', exact: true }), dialog.getByRole('button', { name: 'Close', exact: true })]) {
        await reveal(control); await usable(control);
      }
      await reveal(dialog.getByRole('button', { name: entry.submit, exact: true }));
      await usable(dialog.getByRole('button', { name: entry.submit, exact: true }));
      const actionsPath = testInfo.outputPath(`${name}-${entry.name.replace(/ /g, '-')}-actions.png`);
      await page.screenshot({ fullPage: true, path: actionsPath });
      await testInfo.attach(`${name}-${entry.name}-actions`, { path: actionsPath, contentType: 'image/png' });
    }
    await testInfo.attach('font-evidence', { body: JSON.stringify(fontEvidence, null, 2), contentType: 'application/json' });
  });
}

async function reveal(control: Locator) {
  await control.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }));
}
async function coarsePointer(page: Page) {
  // Match the adaptive-overlays capability shim: explicit emulation, not a
  // claim that the Android callback or viewport makes this a touch device.
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    const overrides = new Map<string, MediaQueryList>();
    const coarseQueries = ['(pointer: coarse)', '(any-pointer: coarse)'];
    const fineQueries = ['(pointer: fine)', '(any-pointer: fine)', '(hover: hover)', '(any-hover: hover)'];
    window.matchMedia = (query) => {
      if (!coarseQueries.includes(query) && !fineQueries.includes(query)) return original(query);
      if (!overrides.has(query)) overrides.set(query, Object.assign(new EventTarget(), {
        media: query, matches: coarseQueries.includes(query), onchange: null,
      }) as MediaQueryList);
      return overrides.get(query)!;
    };
  });
}
async function wheelToOption(page: Page, menu: Locator, option: Locator, direction: 1 | -1) {
  await menu.hover();
  // Radix repositions the focused option when a scroll control first mounts.
  // Firefox advances fewer rows per wheel event. Keep supplying real input
  // while checking observable progress instead of backing off to one per second.
  const progress: unknown[] = [];
  try {
    await expect.poll(async () => {
      await page.mouse.wheel(0, direction * 1000);
      const frame = await option.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const viewport = element.closest('[data-radix-select-viewport]');
        return { reachable: hit === element || element.contains(hit), option: element.textContent,
          scrollTop: viewport?.scrollTop, scrollHeight: viewport?.scrollHeight, clientHeight: viewport?.clientHeight };
      });
      progress.push(frame);
      return frame.reachable;
    }, { message: 'Wheel scrolling must expose the endpoint option', intervals: [100], timeout: 10_000 }).toBe(true);
  } finally {
    await test.info().attach(`selector-wheel-${direction === 1 ? 'last' : 'first'}-progress`, { body: JSON.stringify(progress, null, 2), contentType: 'application/json' });
  }
}
async function usable(control: Locator) {
  await expect(control).toBeInViewport({ ratio: 1 });
  await expect.poll(() => control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return [0.15, 0.5, 0.85].map((fraction) => {
      const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height * fraction);
      return target === element || element.contains(target);
    });
  }), { message: 'Visible controls must receive pointer input across their height' }).toEqual([true, true, true]);
}

type FixtureAPI = ResponsiveComposersAPI;
export type { FixtureAPI };
