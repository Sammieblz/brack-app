import { expect, test, type Locator, type Page } from '@playwright/test';
import type {} from '../fixtures/library-tasks/main';
import type { Operation, Mode } from '../fixtures/library-tasks/state';

const title = 'The Left Hand of Darkness';
const second = 'A Psalm for the Wild-Built';
const third = 'Braiding Sweetgrass';
const membership = (page: Page) => page.getByRole('dialog', { name: 'Add to Lists', exact: true });
const addBooks = (page: Page) => page.getByRole('dialog', { name: 'Add Books to List', exact: true });
const logs = new WeakMap<Page, { errors: string[]; warnings: string[] }>();
test.beforeEach(async ({ page }) => {
  const record = { errors: [] as string[], warnings: [] as string[] }; logs.set(page, record);
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) record.warnings.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
test.afterEach(async ({ page }, info) => {
  const record = logs.get(page)!;
  await info.attach('browser-diagnostics', { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
  await info.attach('service-evidence', { body: JSON.stringify(await page.evaluate(() => window.libraryTasks?.snapshot()).catch(() => null), null, 2), contentType: 'application/json' });
  expect(record.errors, 'No uncaught render errors').toEqual([]);
  expect(record.warnings.filter(value => /DialogContent.*(DialogTitle|Description)|Missing.*Description/i.test(value)), 'Named tasks').toEqual([]);
});
async function open(page: Page, path = '/my-books', query = '', viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.goto(`${path}?runtime=android${query ? `&${query}` : ''}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
}
async function configure(page: Page, operation: Operation, mode: Mode, key = '') {
  await page.evaluate(({ operation, mode, key }) => window.libraryTasks!.configure(operation, mode, key), { operation, mode, key });
}
async function calls(page: Page, operation: Operation) { return page.evaluate(op => window.libraryTasks!.snapshot().calls.filter(call => call.operation === op), operation); }
async function pending(page: Page, operation: Operation) {
  await expect.poll(() => page.evaluate(op => window.libraryTasks!.snapshot().pending.some(item => item.operation === op), operation)).toBe(true);
}
async function settle(page: Page, operation: Operation, outcome: 'resolve' | 'reject', key?: string) {
  await pending(page, operation);
  await page.evaluate(({ operation, outcome, key }) => window.libraryTasks!.settle(operation, outcome, key), { operation, outcome, key });
}
async function back(page: Page) {
  await expect.poll(() => page.evaluate(() => window.libraryTasks!.native().active)).toBe(1);
  await test.info().attach('before-app-back', { body: JSON.stringify(await page.evaluate(() => ({
    active: document.activeElement?.outerHTML.slice(0, 400),
    layers: [...document.querySelectorAll('[data-state="open"],[role="tooltip"]')].map(element => ({
      role: element.getAttribute('role'), state: element.getAttribute('data-state'), text: element.textContent?.slice(0, 100),
    })),
  })), null, 2), contentType: 'application/json' });
  await page.evaluate(() => window.libraryTasks!.back());
}
async function locked(page: Page, dialog: Locator, operation: Operation) {
  await pending(page, operation);
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  if (await close.count()) await close.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  await back(page); await expect(dialog).toBeVisible();
  // Real pointer dismissal outside the sheet/center panel, never force-click.
  const bounds = (await dialog.boundingBox())!;
  if (bounds.y > 4) { await page.mouse.click(2, 2); await expect(dialog).toBeVisible(); }
}
type Entry = 'flat' | 'bookshelf' | 'carousel' | 'carousel-preview' | 'BookDetail';
const entries: Entry[] = ['flat', 'bookshelf', 'carousel', 'carousel-preview', 'BookDetail'];
async function entry(page: Page, name: Entry, query = '', viewport?: { width: number; height: number }) {
  const view = name === 'carousel-preview' ? 'carousel' : name;
  await open(page, name === 'BookDetail' ? '/book/book-1' : '/my-books', `view=${view}${query ? `&${query}` : ''}`, viewport);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  let scope: Page | Locator = page;
  if (name === 'bookshelf' || name === 'carousel-preview') {
    if (name === 'carousel-preview') await page.locator('.library-carousel-card').first().getByRole('heading', { name: title, exact: true }).click();
    else await page.getByRole('button', { name: `Open ${title}`, exact: true }).click();
    scope = page.getByRole('dialog', { name: title, exact: true });
    await expect(scope).toBeVisible();
  } else if (name === 'flat') scope = page.locator('.library-book-surface').first();
  else if (name === 'carousel') scope = page.locator('.library-carousel-card').first();
  if (name !== 'BookDetail') {
    const more = scope.getByRole('button', { name: `More actions for ${title}`, exact: true });
    await more.click();
  }
  return scope;
}
async function membershipEntry(page: Page, name: Entry) {
  const scope = await entry(page, name);
  await scope.getByRole('button', { name: 'Add to list', exact: true }).click();
  await expect(membership(page)).toBeVisible();
  return membership(page);
}
for (const name of entries) {
  test(`${name}: membership lookup and failed writes stay truthful and retry once`, async ({ page }) => {
    const scope = await entry(page, name);
    await configure(page, 'book-membership', 'reject'); await configure(page, 'catalog', 'reject');
    await scope.getByRole('button', { name: 'Add to list', exact: true }).click();
    const dialog = membership(page);
    await expect(dialog.getByRole('button', { name: 'Retry membership', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Retry lists', exact: true })).toBeVisible();
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);
    await configure(page, 'catalog', 'resolve'); await dialog.getByRole('button', { name: 'Retry lists', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Retry lists', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Retry membership', exact: true })).toBeVisible();
    await configure(page, 'book-membership', 'resolve'); await dialog.getByRole('button', { name: 'Retry membership', exact: true }).click();
    const existing = dialog.getByRole('checkbox', { name: 'Weekend reading', exact: true });
    const choice = dialog.getByRole('checkbox', { name: 'Thoughtful journeys', exact: true });
    await expect(existing).toBeChecked(); await expect(choice).not.toBeChecked();
    await configure(page, 'membership-add', 'defer'); await choice.click();
    await locked(page, dialog, 'membership-add'); await expect(choice).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
    expect(await calls(page, 'membership-add')).toHaveLength(1);
    await settle(page, 'membership-add', 'reject');
    await expect(dialog.getByRole('alert').filter({ hasText: 'Your selection is unchanged' })).toBeVisible();
    await expect(choice).not.toBeChecked(); await expect(choice).toHaveAccessibleDescription(/Your selection is unchanged/);
    await configure(page, 'membership-add', 'resolve'); await choice.click(); await expect(choice).toBeChecked();
    await configure(page, 'membership-remove', 'reject'); await existing.click();
    await expect(existing).toBeChecked(); await expect(dialog.getByRole('alert').filter({ hasText: 'Your selection is unchanged' })).toBeVisible();
    await configure(page, 'membership-remove', 'resolve'); await existing.click(); await expect(existing).not.toBeChecked();
    expect(await calls(page, 'membership-add')).toHaveLength(2); expect(await calls(page, 'membership-remove')).toHaveLength(2);
    await dialog.getByRole('button', { name: 'Done', exact: true }).click(); await expect(dialog).toHaveCount(0);
  });
  test(`${name}: same membership node and parent selection survive every breakpoint and nested Back`, async ({ page }) => {
    const dialog = await membershipEntry(page, name);
    const choice = dialog.getByRole('checkbox', { name: 'Weekend reading', exact: true });
    await expect(choice).toBeChecked(); await choice.focus();
    const node = await choice.elementHandle();
    for (const width of [767, 768, 834, 1024, 1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(choice).toBeChecked();
      expect(await choice.evaluate((current, previous) => current === previous, node)).toBe(true);
      await expect(choice).toBeFocused();
    }
    const dialogNode = await dialog.elementHandle();
    await back(page); await expect(dialog).toHaveCount(0);
    if (name === 'bookshelf' || name === 'carousel-preview') {
      const parent = page.getByRole('dialog', { name: title, exact: true });
      await expect(parent).toBeVisible(); await expect(parent.getByRole('button', { name: 'Add to list', exact: true })).toBeFocused();
      await expect.poll(() => dialogNode!.evaluate(node => node.isConnected), { message: 'The nested exit must finish before a second app Back' }).toBe(false);
      // The labelled action no longer needs an icon tooltip; the next Back closes the preview.
      await expect(page.getByRole('tooltip', { name: 'Add to list', exact: true })).toHaveCount(0);
      await back(page); await expect(parent).toHaveCount(0);
      await expect(page.getByRole('button', { name: `Open ${title}`, exact: true })).toBeFocused().catch(async error => {
        await test.info().attach('preview-return-focus', { body: JSON.stringify(await page.evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 500),
          remainingTasks: [...document.querySelectorAll('[role="dialog"]')].map(node => node.outerHTML.slice(0, 300)) }))), contentType: 'application/json' });
        throw error;
      });
      if (name === 'carousel-preview') {
        await page.getByRole('button', { name: `Open ${title}`, exact: true }).press('Enter');
        await expect(parent).toBeVisible();
      }
    } else await expect(page.getByRole('button', { name: 'Add to list', exact: true }).first()).toBeFocused();
  });
}

async function managerAction(page: Page, action: 'Edit' | 'Duplicate' | 'Delete') {
  await page.getByRole('button', { name: 'Actions for Weekend reading', exact: true }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}
for (const edit of [false, true]) {
  test(`List ${edit ? 'edit' : 'create'}: stable draft and caret, dirty dismissal, pending rejection, confirmed write despite refresh failure`, async ({ page }) => {
    await open(page, '/lists');
    if (edit) await managerAction(page, 'Edit'); else await page.getByRole('button', { name: 'Create List', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: edit ? 'Edit List' : 'Create List', exact: true });
    const field = dialog.getByRole('textbox', { name: 'Name', exact: true });
    await field.fill('The quiet reading collection'); await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Chapters to revisit together.');
    await field.focus(); await field.evaluate((input: HTMLInputElement) => input.setSelectionRange(4, 9));
    const node = await field.elementHandle();
    for (const width of [767, 768, 834, 1024, 1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await field.evaluate((current, previous) => current === previous, node)).toBe(true);
      await expect(field).toHaveValue('The quiet reading collection'); await expect(field).toBeFocused();
      expect(await field.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([4, 9]);
    }
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    const guard = page.getByRole('dialog', { name: 'Discard list changes?', exact: true });
    await expect(guard.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(guard).toHaveCount(0); await expect(field).toHaveValue('The quiet reading collection');
    const operation = edit ? 'list-update' : 'list-create'; const submit = dialog.getByRole('button', { name: edit ? 'Save Changes' : 'Create List', exact: true });
    await configure(page, operation, 'defer'); await submit.click(); await locked(page, dialog, operation);
    await expect(field).toBeDisabled(); await expect(submit).toBeDisabled(); await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
    expect(await calls(page, operation)).toHaveLength(1); await settle(page, operation, 'reject');
    await expect(dialog.getByRole('alert')).toBeVisible(); await expect(field).toHaveValue('The quiet reading collection');
    await configure(page, operation, 'resolve'); await configure(page, 'catalog', 'reject'); await submit.click();
    await expect(dialog).toHaveCount(0); expect(await calls(page, operation)).toHaveLength(2);
    // Read rejection is visibly separate, and never replays the confirmed mutation.
    await expect(page.getByText(/couldn't load|Failed to fetch|Unable to load|could not load/i).first()).toBeVisible();
    await configure(page, 'catalog', 'resolve');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'The quiet reading collection', exact: true })).toBeVisible();
    expect(await calls(page, operation)).toHaveLength(2);
    if (edit) await page.getByRole('button', { name: 'Actions for The quiet reading collection', exact: true }).click();
    if (edit) await page.getByRole('menuitem', { name: 'Edit', exact: true }).click(); else await page.getByRole('button', { name: 'Create List', exact: true }).click();
    await field.fill('Discard this change'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(guard.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
    await guard.getByRole('button', { name: 'Discard changes', exact: true }).click(); await expect(dialog).toHaveCount(0);
  });
}
test('List delete: failure keeps target, pending consumes every dismissal and retry deletes once', async ({ page }) => {
  await open(page, '/lists'); await managerAction(page, 'Delete');
  const dialog = page.getByRole('dialog', { name: 'Delete list?', exact: true });
  await configure(page, 'list-delete', 'defer'); await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await locked(page, dialog, 'list-delete'); await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  expect(await calls(page, 'list-delete')).toHaveLength(1); await settle(page, 'list-delete', 'reject'); await expect(dialog.getByRole('alert')).toBeVisible();
  await configure(page, 'list-delete', 'resolve'); await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Weekend reading', exact: true })).toHaveCount(0);
  expect(await calls(page, 'list-delete')).toHaveLength(2);
});
test('List duplicate: pending serializes and failed copy is explicit before successful retry', async ({ page }) => {
  await open(page, '/lists'); await configure(page, 'list-duplicate', 'defer'); await managerAction(page, 'Duplicate');
  await pending(page, 'list-duplicate'); await expect(page.getByRole('button', { name: 'Actions for Weekend reading', exact: true })).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Copying your list' })).toBeVisible(); expect(await calls(page, 'list-duplicate')).toHaveLength(1);
  await settle(page, 'list-duplicate', 'reject'); await expect(page.getByRole('alert').filter({ hasText: 'partial copy' })).toBeVisible();
  await configure(page, 'list-duplicate', 'resolve'); await managerAction(page, 'Duplicate');
  await expect(page.getByRole('heading', { name: 'Weekend reading (Copy)', exact: true })).toBeVisible(); expect(await calls(page, 'list-duplicate')).toHaveLength(2);
});

async function listEntry(page: Page, empty: boolean, query = '', viewport?: { width: number; height: number }) {
  await open(page, empty ? '/lists/list-3' : '/lists/list-1', query, viewport);
  await expect(page.getByRole('heading', { name: empty ? 'Empty collection' : 'Weekend reading', exact: true }).first()).toBeVisible();
  const triggers = page.getByRole('button', { name: 'Add Books', exact: true });
  const trigger = empty ? triggers.last() : triggers.first();
  return trigger;
}
for (const empty of [false, true]) {
  const name = empty ? 'Empty list action' : 'List header action';
  test(`${name}: membership lookup failure blocks unverified choices and retry restores actual options`, async ({ page }) => {
    const trigger = await listEntry(page, empty); await configure(page, 'list-membership', 'reject'); await configure(page, 'books', 'reject'); await trigger.click();
    const dialog = addBooks(page);
    await expect(dialog.getByRole('button', { name: 'Retry membership', exact: true })).toBeVisible();
    await expect(dialog.getByRole('checkbox')).toHaveCount(0); await expect(dialog.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Retry library', exact: true })).toBeVisible();
    await configure(page, 'books', 'resolve'); await dialog.getByRole('button', { name: 'Retry library', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Retry library', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);
    await configure(page, 'list-membership', 'resolve'); await dialog.getByRole('button', { name: 'Retry membership', exact: true }).click();
    await expect(dialog.getByRole('checkbox', { name: second, exact: true })).toBeEnabled();
    await expect(dialog.getByRole('checkbox', { name: title, exact: true })).toHaveCount(empty ? 1 : 0);
    expect(await calls(page, 'membership-add')).toHaveLength(0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  });
  test(`${name}: selected node survives every breakpoint, Keep selecting and explicit discard`, async ({ page }) => {
    const trigger = await listEntry(page, empty); await trigger.click();
    const dialog = addBooks(page), choice = dialog.getByRole('checkbox', { name: second, exact: true });
    await choice.check(); await choice.focus(); const node = await choice.elementHandle();
    for (const width of [767, 768, 834, 1024, 1280, 390]) {
      await page.setViewportSize({ width, height: 900 }); await expect(choice).toBeChecked(); await expect(choice).toBeFocused();
      expect(await choice.evaluate((current, previous) => current === previous, node)).toBe(true);
    }
    await back(page);
    const guard = page.getByRole('dialog', { name: 'Discard book selection?', exact: true });
    await expect(guard.getByRole('button', { name: 'Keep selecting', exact: true })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(guard).toHaveCount(0); await expect(choice).toBeChecked();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(guard.getByRole('button', { name: 'Keep selecting', exact: true })).toBeFocused();
    await guard.getByRole('button', { name: 'Keep selecting', exact: true }).click(); await expect(choice).toBeChecked();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await guard.getByRole('button', { name: 'Discard selection', exact: true }).click(); await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused(); await trigger.click(); await expect(choice).not.toBeChecked();
    expect(await calls(page, 'membership-add')).toHaveLength(0);
  });
  test(`${name}: pending partial add retains failed selection through parent refresh and retries only remaining books`, async ({ page }) => {
    const trigger = await listEntry(page, empty); await trigger.click(); const dialog = addBooks(page);
    await dialog.getByRole('checkbox', { name: second, exact: true }).check();
    await dialog.getByRole('checkbox', { name: third, exact: true }).check();
    await configure(page, 'membership-add', 'defer', 'book-2'); await configure(page, 'membership-add', 'reject', 'book-3');
    await dialog.getByRole('button', { name: 'Add (2)', exact: true }).click();
    await locked(page, dialog, 'membership-add'); await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('checkbox', { name: third, exact: true })).toBeDisabled(); expect(await calls(page, 'membership-add')).toHaveLength(1);
    await page.setViewportSize({ width: 834, height: 1112 }); await expect(dialog).toBeVisible();
    await settle(page, 'membership-add', 'resolve', 'book-2');
    await expect(dialog.getByRole('alert')).toContainText('1 book(s) added.');
    await expect(dialog.getByRole('checkbox', { name: second, exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('checkbox', { name: third, exact: true })).toBeChecked();
    await expect.poll(async () => (await calls(page, 'list-books')).length).toBeGreaterThan(1);
    await configure(page, 'membership-add', 'resolve', 'book-3'); await dialog.getByRole('button', { name: 'Add (1)', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: second, exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: third, exact: true })).toBeVisible();
    const writes = await calls(page, 'membership-add'); expect(writes.map(call => call.key)).toEqual(['book-2', 'book-3', 'book-3']);
    await expect(page.getByRole('button', { name: 'Add Books', exact: true }).first()).toBeFocused();
    await page.getByRole('button', { name: 'Add Books', exact: true }).first().click();
    await expect(dialog.getByRole('checkbox', { name: second, exact: true })).toHaveCount(0); await expect(dialog.getByRole('checkbox', { name: third, exact: true })).toHaveCount(0);
  });
}
for (const name of ['flat', 'bookshelf', 'carousel-preview'] as const) {
  test(`${name}: ${name === 'flat' ? 'inline' : 'nested'} delete preserves selection on rejection and removes only after confirmation`, async ({ page }) => {
    const scope = await entry(page, name); await scope.getByRole('button', { name: 'Delete book', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this book?', exact: true });
    await configure(page, 'book-delete', 'defer'); await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await locked(page, dialog, 'book-delete'); expect(await calls(page, 'book-delete')).toHaveLength(1);
    await page.setViewportSize({ width: 834, height: 1112 }); await expect(dialog).toBeVisible();
    await settle(page, 'book-delete', 'reject'); await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep book', exact: true }).click();
    const parent = name === 'flat' ? page.locator('.library-book-surface').first() : page.getByRole('dialog', { name: title, exact: true }); await expect(parent).toBeVisible();
    await expect(parent.getByRole('button', { name: 'Delete book', exact: true })).toBeFocused();
    await parent.getByRole('button', { name: 'Delete book', exact: true }).click();
    await configure(page, 'book-delete', 'resolve'); await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    if (name !== 'flat') await expect(parent).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Open ${title}`, exact: true })).toHaveCount(0); expect(await calls(page, 'book-delete')).toHaveLength(2);
    await expect(page.getByRole('main', { name: 'Library books', exact: true })).toBeFocused();
    // Removing the last book unmounts the entire view, a different owner path.
    const onlyBook = await entry(page, name, 'oneBook=1');
    await onlyBook.getByRole('button', { name: 'Delete book', exact: true }).click();
    await page.getByRole('dialog', { name: 'Delete this book?', exact: true }).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Open ${title}`, exact: true })).toHaveCount(0);
    await expect(page.getByRole('main', { name: 'Library books', exact: true })).toBeFocused();
    expect(await calls(page, 'book-delete')).toHaveLength(1);
  });
}
test('List removal: rejected task retains book, successful retry preserves Library and focuses connected owner', async ({ page }) => {
  await listEntry(page, false);
  await page.getByRole('button', { name: `Remove ${title} from list`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove from list?', exact: true });
  await configure(page, 'membership-remove', 'defer'); await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await locked(page, dialog, 'membership-remove'); await settle(page, 'membership-remove', 'reject'); await expect(dialog.getByRole('alert')).toBeVisible();
  await configure(page, 'membership-remove', 'resolve'); await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
  expect(await calls(page, 'book-delete')).toHaveLength(0); expect(await calls(page, 'membership-remove')).toHaveLength(2);
  await expect(page.getByRole('button', { name: 'Add Books', exact: true }).first()).toBeFocused();
});
test('Library bulk delete: partial failure keeps only failed selection and retry never repeats confirmed removals', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: /Library controls/ }).click(); await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: `Select ${title}`, exact: true }).press('Space'); await page.getByRole('button', { name: `Select ${second}`, exact: true }).press('Space');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Delete 2 selected books?', exact: true });
  await configure(page, 'book-delete', 'defer', 'book-1'); await configure(page, 'book-delete', 'reject', 'book-2');
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click(); await locked(page, dialog, 'book-delete');
  await settle(page, 'book-delete', 'resolve', 'book-1'); dialog = page.getByRole('dialog', { name: 'Delete 1 selected books?', exact: true });
  await expect(dialog.getByRole('alert')).toBeVisible(); await expect(page.getByRole('button', { name: `Select ${title}`, exact: true })).toHaveCount(0);
  await configure(page, 'book-delete', 'resolve', 'book-2'); await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: `Open ${third}`, exact: true })).toBeVisible();
  expect((await calls(page, 'book-delete')).map(call => call.key)).toEqual(['book-1', 'book-2', 'book-2']);
  await expect(page.getByRole('main', { name: 'Library books', exact: true })).toBeFocused();
});
test('Account replacement drops the obsolete pending membership UI and cannot affect the next account', async ({ page }) => {
  const dialog = await membershipEntry(page, 'flat'); await configure(page, 'membership-add', 'defer');
  await dialog.getByRole('checkbox', { name: 'Thoughtful journeys', exact: true }).click(); await pending(page, 'membership-add');
  await page.evaluate(() => window.libraryTasks!.setAccount('another-reader'));
  await expect(dialog).toHaveCount(0); await settle(page, 'membership-add', 'resolve');
  await expect(page.getByText('Added to list', { exact: true })).toHaveCount(0);
  await page.locator('.library-book-surface').first().getByRole('button', { name: `More actions for ${title}`, exact: true }).click();
  await page.locator('.library-book-surface').first().getByRole('button', { name: 'Add to list', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Thoughtful journeys', exact: true })).not.toBeChecked();
});
test('Route abandonment during sequential add stops unsubmitted later books and stale success feedback', async ({ page }) => {
  const trigger = await listEntry(page, true); await trigger.click(); const dialog = addBooks(page);
  await dialog.getByRole('checkbox', { name: second, exact: true }).check(); await dialog.getByRole('checkbox', { name: third, exact: true }).check();
  await configure(page, 'membership-add', 'defer', 'book-2'); await dialog.getByRole('button', { name: 'Add (2)', exact: true }).click();
  await pending(page, 'membership-add'); await page.evaluate(() => window.libraryTasks!.navigate('/outside'));
  await expect(page.getByRole('heading', { name: 'Outside the Library fixture', exact: true })).toBeVisible();
  await settle(page, 'membership-add', 'resolve', 'book-2');
  await expect.poll(async () => (await calls(page, 'membership-add')).map(call => call.key)).toEqual(['book-2']);
  await expect(page.getByText('Books added', { exact: true })).toHaveCount(0);
});
test('Later-page list metadata: pending selected task survives catalog reset, page-two failure and successful retry', async ({ page }) => {
  const trigger = await listEntry(page, true, 'pagedCatalog=1'); await trigger.click(); const dialog = addBooks(page);
  const remaining = dialog.getByRole('checkbox', { name: third, exact: true });
  await dialog.getByRole('checkbox', { name: second, exact: true }).check(); await remaining.check();
  const node = await dialog.elementHandle(), choiceNode = await remaining.elementHandle();
  expect((await calls(page, 'catalog')).some(call => call.key === '15')).toBe(true);
  await configure(page, 'catalog', 'defer', '15'); await configure(page, 'membership-add', 'defer', 'book-3');
  await dialog.getByRole('button', { name: 'Add (2)', exact: true }).click();
  await pending(page, 'membership-add'); await pending(page, 'catalog');
  expect(await dialog.evaluate((current, previous) => current === previous, node)).toBe(true);
  expect(await remaining.evaluate((current, previous) => current === previous, choiceNode)).toBe(true);
  await expect(remaining).toBeChecked(); await expect(remaining).toBeDisabled();
  await settle(page, 'catalog', 'reject', '15'); await expect(dialog).toBeVisible();
  await settle(page, 'membership-add', 'reject', 'book-3');
  await expect(dialog.getByRole('alert')).toContainText('1 book(s) added.'); await expect(remaining).toBeChecked();
  expect(await dialog.evaluate((current, previous) => current === previous, node)).toBe(true);
  await configure(page, 'catalog', 'resolve', '15'); await configure(page, 'membership-add', 'resolve', 'book-3');
  await dialog.getByRole('button', { name: 'Add (1)', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Empty collection', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: second, exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: third, exact: true })).toBeVisible();
  expect((await calls(page, 'membership-add')).map(call => call.key)).toEqual(['book-2', 'book-3', 'book-3']);
});
test('Flat touch swipe delete: revealed real action retains pending target, rejection and successful retry', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Trusted browser touch movement uses Chromium CDP; this is emulation, not native-device evidence.');
  await entry(page, 'flat');
  const card = page.locator('.library-book-surface').first(); await card.scrollIntoViewIfNeeded();
  const bounds = (await card.boundingBox())!; const session = await page.context().newCDPSession(page);
  const x = bounds.x + bounds.width;
  const y = bounds.y + 70;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 25, y }] });
  for (let step = 1; step <= 12; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 25 - step * 13, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page).toHaveURL(/\/my-books/);
  const tray = card.locator('../..').getByRole('button', { name: 'Delete book', exact: true }).first();
  await tray.click(); const dialog = page.getByRole('dialog', { name: 'Delete this book?', exact: true });
  await configure(page, 'book-delete', 'defer'); await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await locked(page, dialog, 'book-delete'); await settle(page, 'book-delete', 'reject'); await expect(dialog.getByRole('alert')).toBeVisible();
  await configure(page, 'book-delete', 'resolve'); await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: `Open ${title}`, exact: true })).toHaveCount(0);
  expect(await calls(page, 'book-delete')).toHaveLength(2);
  await expect(page.getByRole('main', { name: 'Library books', exact: true })).toBeFocused();
});

const profiles = [
  { name: 'phone-320', width: 320, height: 740, large: false, coarse: false },
  { name: 'phone-large-text', width: 390, height: 844, large: true, coarse: false },
  { name: 'tablet-touch-large-text', width: 834, height: 1112, large: true, coarse: true },
  { name: 'short-height', width: 390, height: 480, large: false, coarse: false },
];
for (const profile of profiles) {
  test(`Visual ${profile.name}: real selection, nested membership, list editor and removal remain reachable with loaded fonts`, async ({ page }, info) => {
    test.setTimeout(180_000);
    if (profile.coarse) await coarsePointer(page);
    const viewport = { width: profile.width, height: profile.height }, query = profile.large ? 'text=200' : '';
    const inspect = async (dialog: Locator, name: string, controls: Locator[]) => {
      await expect(dialog).toBeVisible();
      const fonts = await page.evaluate(async () => {
        await Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(font => document.fonts.load(`16px "${font}"`)));
        await document.fonts.ready;
        return ['Inter', 'Merriweather', 'Playfair Display'].map(family => ({ family,
          faces: [...document.fonts].filter(face => face.family.replace(/["']/g, '') === family).map(face => ({ status: face.status, weight: face.weight })) }));
      });
      for (const font of fonts) expect(font.faces.some(face => face.status === 'loaded'), `${font.family} actual loaded face`).toBe(true);
      await info.attach(`${profile.name}-${name}-fonts`, { body: JSON.stringify(fonts, null, 2), contentType: 'application/json' });
      const geometry = await dialog.evaluate(element => ({
        overflow: element.scrollWidth - element.clientWidth, bounds: element.getBoundingClientRect().toJSON(),
        protrusions: [...element.querySelectorAll<HTMLElement>('input,textarea,button,[role=checkbox],h2,p,label')].flatMap(child => {
          const box = child.getBoundingClientRect(), parent = element.getBoundingClientRect();
          return box.right > parent.right + 1 || box.left < parent.left - 1 ? [{ text: child.textContent?.slice(0, 60), box: box.toJSON() }] : [];
        }),
      }));
      await info.attach(`${profile.name}-${name}-geometry`, { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
      expect(geometry.overflow, `${name} horizontal overflow`).toBeLessThanOrEqual(1);
      if (profile.coarse && await dialog.getAttribute('data-presentation') !== null) await expect(dialog).toHaveAttribute('data-presentation', 'sheet');
      for (const control of controls) { await reveal(control); await usable(control); }
      const picture = info.outputPath(`${profile.name}-${name}.png`); await page.screenshot({ path: picture, fullPage: true });
      await info.attach(`${profile.name}-${name}`, { path: picture, contentType: 'image/png' });
    };
    await entry(page, 'bookshelf', query, viewport);
    let dialog = page.getByRole('dialog', { name: title, exact: true });
    await inspect(dialog, 'bookshelf-selection', [dialog.getByRole('button', { name: 'Add to list', exact: true }), dialog.getByRole('button', { name: 'Delete book', exact: true })]);
    await dialog.getByRole('button', { name: 'Add to list', exact: true }).click(); dialog = membership(page);
    await expect(dialog.getByRole('checkbox', { name: 'Weekend reading', exact: true })).toBeChecked();
    await inspect(dialog, 'nested-membership', [dialog.getByRole('checkbox', { name: 'Weekend reading', exact: true }), dialog.getByRole('checkbox', { name: 'Empty collection', exact: true }), dialog.getByRole('button', { name: 'Done', exact: true })]);
    await open(page, '/lists', query, viewport); await page.getByRole('button', { name: 'Create List', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Create List', exact: true }); await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Quiet reading weekends');
    await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('A thoughtful collection of stories for long journeys.');
    await inspect(dialog, 'create-list', [dialog.getByRole('textbox', { name: 'Name', exact: true }), dialog.getByRole('textbox', { name: 'Description', exact: true }), dialog.getByRole('button', { name: 'Cancel', exact: true }), dialog.getByRole('button', { name: 'Create List', exact: true })]);
    await open(page, '/lists', query, viewport); await managerAction(page, 'Edit'); dialog = page.getByRole('dialog', { name: 'Edit List', exact: true });
    await inspect(dialog, 'edit-list', [dialog.getByRole('textbox', { name: 'Name', exact: true }), dialog.getByRole('button', { name: 'Save Changes', exact: true })]);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await managerAction(page, 'Delete'); dialog = page.getByRole('dialog', { name: 'Delete list?', exact: true });
    await inspect(dialog, 'delete-list', [dialog.getByRole('button', { name: 'Cancel', exact: true }), dialog.getByRole('button', { name: 'Delete', exact: true })]);
    const trigger = await listEntry(page, true, query, viewport); await trigger.click(); dialog = addBooks(page);
    await dialog.getByRole('checkbox', { name: second, exact: true }).check();
    await inspect(dialog, 'add-books', [dialog.getByRole('checkbox', { name: title, exact: true }), dialog.getByRole('checkbox', { name: third, exact: true }), dialog.getByRole('button', { name: 'Cancel', exact: true }), dialog.getByRole('button', { name: 'Add (1)', exact: true })]);
    await listEntry(page, false, query, viewport);
    const remove = page.getByRole('button', { name: `Remove ${title} from list`, exact: true });
    await reveal(remove);
    await remove.locator('..').getByRole('button', { name: 'Details', exact: true }).focus();
    await page.keyboard.press('Tab'); await expect(remove).toBeFocused(); await usable(remove);
    const row = remove.locator('xpath=ancestor::div[contains(@class,"group") and contains(@class,"h-full")][1]');
    const rowOverflow = await row.evaluate(element => ({ overflow: element.scrollWidth - element.clientWidth, bounds: element.getBoundingClientRect().toJSON() }));
    await info.attach(`${profile.name}-list-row-geometry`, { body: JSON.stringify(rowOverflow, null, 2), contentType: 'application/json' });
    expect(rowOverflow.overflow, 'Actual list card must not clip its actions').toBeLessThanOrEqual(1);
    const rowPicture = info.outputPath(`${profile.name}-list-row.png`); await page.screenshot({ path: rowPicture, fullPage: true });
    await info.attach(`${profile.name}-list-row`, { path: rowPicture, contentType: 'image/png' });
    await remove.click();
    dialog = page.getByRole('dialog', { name: 'Remove from list?', exact: true });
    await inspect(dialog, 'remove-from-list', [dialog.getByRole('button', { name: 'Cancel', exact: true }), dialog.getByRole('button', { name: 'Remove', exact: true })]);
  });
}
async function reveal(control: Locator) { await control.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })); }
async function usable(control: Locator) {
  await expect(control).toBeInViewport({ ratio: 1 });
  await expect.poll(() => control.evaluate(element => {
    const box = element.getBoundingClientRect();
    return [0.15, 0.5, 0.85].map(fraction => { const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height * fraction); return hit === element || element.contains(hit); });
  }), { message: 'Visible controls must receive pointer input across their height' }).toEqual([true, true, true]);
}
async function coarsePointer(page: Page) {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window), overrides = new Map<string, MediaQueryList>();
    const coarse = ['(pointer: coarse)', '(any-pointer: coarse)'], fine = ['(pointer: fine)', '(any-pointer: fine)', '(hover: hover)', '(any-hover: hover)'];
    window.matchMedia = query => {
      if (!coarse.includes(query) && !fine.includes(query)) return original(query);
      if (!overrides.has(query)) overrides.set(query, Object.assign(new EventTarget(), { media: query, matches: coarse.includes(query), onchange: null }) as MediaQueryList);
      return overrides.get(query)!;
    };
  });
}
