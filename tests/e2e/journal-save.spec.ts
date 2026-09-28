import { expect, test, type Locator, type Page } from '@playwright/test';
import type { FixtureSnapshot } from '../fixtures/journal-save/state';

type EditorKind = 'full' | 'quick';
const failureText = 'Could not save your entry. Your draft is still here. Try again.';
const draftTitle = 'The paragraph I want to remember';
const draftContent = 'The quiet details deserve a second reading.';
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:8086' ? route.continue() : route.abort();
  });
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'No uncaught browser errors, including rejected save promises').toEqual([]);
});

const snapshot = (page: Page): Promise<FixtureSnapshot> => page.evaluate(() => window.journalFixture.snapshot());
const editor = (dialog: Locator) => dialog.locator('[contenteditable]');
const saveButton = (dialog: Locator) => dialog.getByRole('button', { name: /^(Add|Update|Save) Entry$/ });

async function load(page: Page, query = '', width = 1024) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/${query}`);
  await expect(page.getByRole('heading', { name: 'Journal save regression fixture' })).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => Boolean(window.journalFixture));
}

async function openEditor(page: Page, kind: EditorKind, keyboard = false) {
  const trigger = page.getByRole('button', { name: kind === 'full' ? 'Add Entry' : 'Open quick journal', exact: true });
  if (keyboard) {
    // Safari deliberately does not focus buttons on pointer click. Focus-return
    // assertions exercise keyboard invocation; pointer save paths remain below.
    await trigger.focus();
    await trigger.press('Enter');
  } else {
    await trigger.click();
  }
  const dialog = page.getByRole('dialog', { name: 'Add Journal Entry', exact: true });
  await expect(dialog).toBeVisible();
  await expect(editor(dialog)).toBeVisible();
  return dialog;
}

async function fillDraft(dialog: Locator, kind: EditorKind, withPhoto = true) {
  await dialog.getByLabel(/Title \(Optional\)/i).fill(draftTitle);
  await editor(dialog).fill(draftContent);
  await editor(dialog).press('ControlOrMeta+a');
  await dialog.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(editor(dialog).locator('strong')).toHaveText(draftContent);
  await dialog.getByLabel(/Page Reference \(Optional\)/i).fill('43');
  if (kind === 'full') {
    await dialog.getByRole('combobox', { name: 'Entry Type' }).click();
    await dialog.page().getByRole('option', { name: 'Quote', exact: true }).click();
    await dialog.getByLabel('Tags (Optional)', { exact: true }).fill('Close reading');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  } else {
    await dialog.getByRole('group', { name: 'Entry Type', exact: true }).getByRole('button', { name: 'Quote', exact: true }).click();
  }
  if (withPhoto) {
    await dialog.getByRole('button', { name: 'Quick Add', exact: true }).click();
    await expect(dialog.getByRole('img', { name: 'Journal attachment preview', exact: true })).toBeVisible();
  }
}

async function expectDraft(dialog: Locator, kind: EditorKind, withPhoto = true) {
  await expect(dialog.getByLabel(/Title \(Optional\)/i)).toHaveValue(draftTitle);
  await expect(editor(dialog)).toHaveText(draftContent);
  await expect(editor(dialog).locator('strong')).toHaveText(draftContent);
  await expect(dialog.getByLabel(/Page Reference \(Optional\)/i)).toHaveValue('43');
  if (kind === 'full') {
    await expect(dialog.getByRole('combobox', { name: 'Entry Type' })).toHaveText('Quote');
    await expect(dialog.getByText('Close reading', { exact: true })).toBeVisible();
  }
  if (withPhoto) await expect(dialog.getByRole('img', { name: 'Journal attachment preview', exact: true })).toBeVisible();
}

async function submit(page: Page, dialog: Locator, expectedCount: number) {
  await saveButton(dialog).dblclick({ delay: 10 });
  await expect.poll(async () => (await snapshot(page)).writes.length).toBe(expectedCount);
  await expect(dialog.getByRole('button', { name: /Saving/ })).toBeDisabled();
}

for (const kind of ['full', 'quick'] as const) {
  test(`${kind}: opening an empty editor and cancelling does not prompt to discard`, async ({ page }) => {
    await load(page, '', 390);
    const dialog = await openEditor(page, kind, true);
    await expect(editor(dialog)).toBeEmpty();
    await dialog.getByRole('button', { name: kind === 'full' ? 'Cancel' : 'Skip', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Discard this draft?', { exact: true })).toHaveCount(0);
    expect((await snapshot(page)).writes).toHaveLength(0);
    await expect(page.getByRole('button', { name: kind === 'full' ? 'Add Entry' : 'Open quick journal', exact: true })).toBeFocused();
  });

  test(`${kind}: rejected save preserves formatted writing, metadata and attachment; retry commits once`, async ({ page }) => {
    await load(page, '', kind === 'full' ? 390 : 834);
    const dialog = await openEditor(page, kind);
    await fillDraft(dialog, kind);
    await submit(page, dialog, 1);
    await expect(editor(dialog)).toHaveAttribute('contenteditable', 'false');
    await expect(dialog.getByLabel(/Title \(Optional\)/i)).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled();

    // The visible Close control and Escape must not detach an in-flight save.
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect((await snapshot(page)).writes).toHaveLength(1);
    expect((await snapshot(page)).records).toHaveLength(0);
    await page.evaluate(() => window.journalFixture.rejectNext());
    await expect(dialog.getByText(failureText, { exact: true })).toBeVisible();
    await expectDraft(dialog, kind);
    const failedPayload = (await snapshot(page)).writes[0].payload;
    expect(failedPayload).toMatchObject({
      book_id: 'journal-fixture-book', entry_type: 'quote', title: draftTitle,
      content: draftContent, content_format: 'tiptap', page_reference: 43,
      photo_url: 'http://127.0.0.1:8086/attachment.svg?upload=1',
    });
    expect(failedPayload.content_html).toContain(`<strong>${draftContent}</strong>`);

    // Use keyboard activation on retry to exercise the real form action.
    await saveButton(dialog).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await snapshot(page)).writes.length).toBe(2);
    await page.evaluate(() => window.journalFixture.resolveNext());
    await expect(dialog).toHaveCount(0);
    const result = await snapshot(page);
    expect(result.records).toHaveLength(1);
    expect(result.writes[1].payload).toEqual(failedPayload);
    expect(result.records[0].content_json).toEqual(failedPayload.content_json);
    expect(result.uploads).toBe(1);
    expect(result.removals).toEqual([]);
    await expect(page.getByText('Journal entry saved', { exact: true })).toBeVisible();
    const reopened = await openEditor(page, kind);
    await expect(reopened.getByLabel(/Title \(Optional\)/i)).toBeEmpty();
    await expect(editor(reopened)).toBeEmpty();
  });

  test(`${kind}: offline local commit closes immediately with truthful local-save feedback`, async ({ page }) => {
    await load(page, '?offline=1', 390);
    const dialog = await openEditor(page, kind);
    await fillDraft(dialog, kind, false);
    await submit(page, dialog, 1);
    await page.evaluate(() => window.journalFixture.resolveNext());
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Journal entry saved', { exact: true })).toBeVisible();
    await expect(page.getByText('Saved on this device. Changes will sync automatically.', { exact: true })).toBeVisible();
    const result = await snapshot(page);
    expect(result.records).toHaveLength(1);
    expect(result.writes).toHaveLength(1);
    expect(result.fetches).toBe(0);
  });

  test(`${kind}: cancellation keeps the draft until explicit discard and restores focus`, async ({ page }) => {
    await load(page, '', 390);
    const dialog = await openEditor(page, kind, true);
    await fillDraft(dialog, kind);
    await dialog.getByRole('button', { name: kind === 'full' ? 'Cancel' : 'Skip', exact: true }).click();
    await expect(dialog.getByText('Discard this draft?', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expectDraft(dialog, kind);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await dialog.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: kind === 'full' ? 'Add Entry' : 'Open quick journal', exact: true })).toBeFocused();
    expect((await snapshot(page)).writes).toHaveLength(0);
    const reopened = await openEditor(page, kind);
    await expect(reopened.getByLabel(/Title \(Optional\)/i)).toBeEmpty();
    await expect(editor(reopened)).toBeEmpty();
  });

  test(`${kind}: delayed failed upload locks dismissal and preserves writing and the previous photo`, async ({ page }) => {
    await load(page, '', 390);
    const dialog = await openEditor(page, kind);
    await fillDraft(dialog, kind);
    const preview = dialog.getByRole('img', { name: 'Journal attachment preview', exact: true });
    await expect(preview).toHaveAttribute('src', 'http://127.0.0.1:8086/attachment.svg?upload=1');
    await page.evaluate(() => window.journalFixture.deferUploads(true));
    await dialog.getByRole('button', { name: 'Quick Add', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).uploads).toBe(2);
    await expect(saveButton(dialog)).toBeDisabled();
    await expect(editor(dialog)).toHaveAttribute('contenteditable', 'false');
    await expect(dialog.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled();
    await expect(dialog.getByLabel(/Title \(Optional\)/i)).toBeDisabled();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect((await snapshot(page)).writes).toHaveLength(0);
    await page.evaluate(() => window.journalFixture.rejectUpload());
    await expect(dialog.getByText('Could not upload your photo. Your entry is unchanged. Try again.', { exact: true })).toBeVisible();
    await expectDraft(dialog, kind);
    await expect(preview).toHaveAttribute('src', 'http://127.0.0.1:8086/attachment.svg?upload=1');
    await expect(saveButton(dialog)).toBeEnabled();
    expect((await snapshot(page)).removals).toEqual([]);
    await dialog.getByRole('button', { name: 'Quick Add', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).uploads).toBe(3);
    await page.evaluate(() => window.journalFixture.resolveUpload());
    await expect(preview).toHaveAttribute('src', 'http://127.0.0.1:8086/attachment.svg?upload=3');
    await submit(page, dialog, 1);
    await page.evaluate(() => window.journalFixture.resolveNext());
    await expect(dialog).toHaveCount(0);
    expect((await snapshot(page)).records[0].photo_url).toBe('http://127.0.0.1:8086/attachment.svg?upload=3');
    expect((await snapshot(page)).removals).toEqual([]);
  });
}

test('a committed entry stays successful when book status and refresh both fail', async ({ page }) => {
  await load(page);
  const dialog = await openEditor(page, 'full');
  await fillDraft(dialog, 'full', false);
  await page.evaluate(() => {
    window.journalFixture.failLocalRead(true);
    window.journalFixture.failBookStatus(true);
  });
  await submit(page, dialog, 1);
  await page.evaluate(() => window.journalFixture.resolveNext());
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Book journal' }).getByText(/could not be refreshed.*saved writing is safe/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: draftTitle, exact: true })).toBeVisible();
  const reopened = await openEditor(page, 'full');
  await expect(editor(reopened)).toBeEmpty();
  expect((await snapshot(page)).writes).toHaveLength(1);
  expect((await snapshot(page)).records).toHaveLength(1);
});

test('the full editor returns focus to its pointer-invoked Add Entry control', async ({ page }) => {
  await load(page, '', 390);
  const dialog = await openEditor(page, 'full');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Entry', exact: true })).toBeFocused();
});

test('editing failure and discard retain the saved attachment and original record', async ({ page }) => {
  await load(page, '?existing=1');
  const title = page.getByRole('heading', { name: 'Original journal entry', exact: true });
  await expect(title).toBeVisible();
  await page.getByRole('region', { name: 'Book journal' }).getByRole('button', { name: 'Edit journal entry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Journal Entry', exact: true });
  await expect(dialog).toBeVisible();
  const original = (await snapshot(page)).records[0];
  await dialog.getByRole('button', { name: /Remove photo/i }).click();
  await fillDraft(dialog, 'full');
  expect((await snapshot(page)).removals).toEqual([]);
  await submit(page, dialog, 1);
  await page.evaluate(() => window.journalFixture.rejectNext());
  await expect(dialog.getByText(failureText, { exact: true })).toBeVisible();
  await expectDraft(dialog, 'full');
  expect((await snapshot(page)).records[0]).toEqual(original);
  expect((await snapshot(page)).removals).toEqual([]);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await snapshot(page)).records[0]).toEqual(original);
});

test('a successful edit updates the existing entry and explicitly clears a removed photo', async ({ page }) => {
  await load(page, '?existing=1');
  const title = page.getByRole('heading', { name: 'Original journal entry', exact: true });
  await expect(title).toBeVisible();
  await page.getByRole('region', { name: 'Book journal' }).getByRole('button', { name: 'Edit journal entry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Journal Entry', exact: true });
  await dialog.getByRole('button', { name: /Remove photo/i }).click();
  await fillDraft(dialog, 'full', false);
  await submit(page, dialog, 1);
  await page.evaluate(() => window.journalFixture.resolveNext());
  await expect(dialog).toHaveCount(0);
  const result = await snapshot(page);
  expect(result.writes[0]).toMatchObject({ kind: 'update', id: 'journal-fixture-existing', payload: { photo_url: null } });
  expect(result.records).toHaveLength(1);
  expect(result.records[0]).toMatchObject({ id: 'journal-fixture-existing', title: draftTitle, photo_url: null });
  expect(result.removals).toEqual([]);
});

for (const kind of ['full', 'quick'] as const) {
  for (const outcome of ['reject', 'commit'] as const) {
  test(`a pending ${kind}-editor save survives route-like remount and ${outcome} without a second write`, async ({ page }) => {
    await load(page);
    let dialog = await openEditor(page, kind);
    await fillDraft(dialog, kind, false);
    await submit(page, dialog, 1);
    await page.evaluate(() => window.journalFixture.remount());
    if (kind === 'full') {
      await expect(dialog).toHaveCount(0);
      dialog = await openEditor(page, kind);
    }
    await expect(dialog.getByRole('button', { name: /Saving/ })).toBeDisabled();
    expect((await snapshot(page)).writes).toHaveLength(1);
    await page.evaluate((outcome) => {
      if (outcome === 'reject') window.journalFixture.rejectNext();
      else window.journalFixture.resolveNext();
    }, outcome);
    if (outcome === 'reject') {
      await expect(dialog.getByText(failureText, { exact: true })).toBeVisible();
      await expectDraft(dialog, kind, false);
    } else {
      await expect(dialog).toHaveCount(0);
      expect((await snapshot(page)).records).toHaveLength(1);
    }
    expect((await snapshot(page)).writes).toHaveLength(1);
  });
  }
}
