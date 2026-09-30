import { expect, test, type Locator, type Page } from '@playwright/test';
import type { SettingsContinuityAPI } from '../fixtures/settings-continuity/main';
import type { Operation } from '../fixtures/settings-continuity/state';

type Entry = { section: string; label: string; field: string; value: string; save?: string; operation?: Operation };
const entries: Entry[] = [
  { section: 'profile', label: 'Profile', field: 'Display Name', value: 'Alex Reading Slowly', save: 'Save Changes', operation: 'profile-save' },
  { section: 'personal', label: 'Personal Info', field: 'First Name', value: 'Alexandra', save: 'Save Changes', operation: 'personal-save' },
  { section: 'reading', label: 'Reading Profile', field: 'Reading motivation', value: 'Quiet chapters before bed.', save: 'Save', operation: 'reading-save' },
  { section: 'notifications', label: 'Notifications', field: 'Start', value: '21:30', save: 'Save Notification Preferences', operation: 'notification-save' },
  { section: 'data', label: 'Data & Backup', field: 'Backup passphrase', value: 'Fixture passphrase only' },
  { section: 'account', label: 'Account', field: 'Current password', value: 'FixtureCurrent123!' },
];
const backup = { name: 'reading-backup.brack', mimeType: 'application/octet-stream', buffer: Buffer.from('fixture reading backup') };
const photo = { name: 'reader-photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') };
const log = new WeakMap<Page, { errors: string[]; warnings: string[] }>();
const guard = (page: Page) => page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
const editor = (page: Page, entry: Entry) => page.getByRole('region', { name: entry.label, exact: true });
test.beforeEach(async ({ page }) => {
  const record = { errors: [] as string[], warnings: [] as string[] }; log.set(page, record);
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) record.warnings.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (process.env.CR03_ESCAPE_DIAGNOSTICS === '1') await page.addInitScript(() => {
    const records: unknown[] = [];
    (window as Window & { settingsEscapeTrace?: unknown[] }).settingsEscapeTrace = records;
    const record = (phase: string, event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      const target = event.target as HTMLElement;
      records.push({ at: performance.now(), type: event.type, phase, prevented: event.defaultPrevented,
        target: target?.textContent?.slice(0, 70), focused: document.activeElement?.textContent?.slice(0, 70),
        dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => ({ id: node.id, state: node.getAttribute('data-state'), pointer: (node as HTMLElement).style.pointerEvents, text: node.textContent?.slice(0, 50) })) });
    };
    document.addEventListener('keydown', event => record('capture', event), true);
    document.addEventListener('keydown', event => record('bubble', event));
    document.addEventListener('focusin', event => record('focus', event));
    document.addEventListener('dismissableLayer.update', event => record('layer-update', event));
  });
});
test.afterEach(async ({ page }, info) => {
  const record = log.get(page)!;
  await info.attach('browser-diagnostics', { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
  await info.attach('service-evidence', { body: JSON.stringify(await page.evaluate(() => window.settingsContinuity?.snapshot()).catch(() => null), null, 2), contentType: 'application/json' });
  if (process.env.CR03_ESCAPE_DIAGNOSTICS === '1') await info.attach('escape-ownership-trail', {
    body: JSON.stringify(await page.evaluate(() => (window as Window & { settingsEscapeTrace?: unknown[] }).settingsEscapeTrace), null, 2), contentType: 'application/json' });
  expect(record.errors, 'No uncaught render errors').toEqual([]);
  expect(record.warnings.filter(value => /DialogContent.*(DialogTitle|Description)|Missing.*Description/i.test(value)), 'Named nested tasks').toEqual([]);
});
async function open(page: Page, section = '', viewport = { width: 390, height: 844 }, query = '') {
  await page.setViewportSize(viewport);
  await page.goto(`/settings?runtime=android${section ? `&section=${section}` : ''}${query ? `&${query}` : ''}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
}
async function configure(page: Page, operation: Operation, mode: 'resolve' | 'reject' | 'defer') {
  await page.evaluate(({ operation, mode }) => window.settingsContinuity!.configure(operation, mode), { operation, mode });
}
async function calls(page: Page, operation: Operation) { return page.evaluate(op => window.settingsContinuity!.snapshot().calls.filter(call => call.operation === op), operation); }
async function pending(page: Page, operation: Operation) {
  await expect.poll(() => page.evaluate(op => window.settingsContinuity!.snapshot().pending.includes(op), operation)).toBe(true);
}
async function settle(page: Page, operation: Operation, outcome: 'resolve' | 'reject') {
  await pending(page, operation);
  await page.evaluate(({ operation, outcome }) => window.settingsContinuity!.settle(operation, outcome), { operation, outcome });
}
async function appBack(page: Page) {
  await expect.poll(() => page.evaluate(() => window.settingsContinuity!.native().active)).toBe(1);
  await page.evaluate(() => window.settingsContinuity!.back());
}
async function fill(page: Page, entry: Entry) {
  const owner = editor(page, entry);
  if (entry.section === 'reading') await owner.getByRole('button', { name: 'Edit', exact: true }).click();
  if (entry.section === 'data') await owner.getByLabel('Import backup file', { exact: true }).setInputFiles(backup);
  const field = owner.getByLabel(entry.field, { exact: true });
  await field.fill(entry.value);
  if (entry.section === 'profile') await owner.getByLabel('Bio', { exact: true }).fill('A thoughtful paragraph stays with me.');
  if (entry.section === 'personal') await owner.getByLabel('Date of Birth', { exact: true }).fill('06/17/1992');
  if (entry.section === 'reading') {
    await owner.getByRole('group', { name: 'Favorite Genres', exact: true }).getByRole('button', { name: 'Mystery', exact: true }).click();
    await owner.getByRole('combobox', { name: 'Preferred reading time', exact: true }).click();
    await page.getByRole('option', { name: 'Night', exact: true }).click();
  }
  if (entry.section === 'notifications') await owner.getByLabel('End', { exact: true }).fill('06:15');
  if (entry.section === 'data') {
    await page.evaluate(() => {
      const record: unknown[] = [];
      const observe = (event: Event) => {
        const button = [...document.querySelectorAll('button')].find(node => node.textContent === 'Preview import');
        const target = event.target as HTMLElement;
        record.push({ type: event.type, target: target.tagName, text: target.textContent?.slice(0, 70), button: button?.getBoundingClientRect().toJSON(), scroll: document.querySelector('[data-app-scroll-container]')?.scrollTop });
      };
      const events = ['pointerdown', 'pointerup', 'click', 'focusin', 'focusout'];
      events.forEach(type => document.addEventListener(type, observe, true));
      (window as Window & { stopPreviewTrace?: () => unknown[] }).stopPreviewTrace = () => { events.forEach(type => document.removeEventListener(type, observe, true)); return record; };
    });
    await owner.getByRole('button', { name: 'Preview import', exact: true }).click();
    const pointer = await page.evaluate(() => (window as Window & { stopPreviewTrace?: () => unknown[] }).stopPreviewTrace?.());
    await test.info().attach('preview-pointer-trail', { body: JSON.stringify(pointer, null, 2), contentType: 'application/json' });
    await expect(owner.getByRole('heading', { name: 'Import preview', exact: true })).toBeVisible();
  }
  if (entry.section === 'account') {
    await owner.getByLabel('New password', { exact: true }).fill('FixtureNext456!');
    await owner.getByLabel('Confirm new password', { exact: true }).fill('FixtureNext456!');
  }
  return field;
}
async function expectDraft(page: Page, entry: Entry) {
  const owner = editor(page, entry);
  await expect(owner.getByLabel(entry.field, { exact: true })).toHaveValue(entry.value);
  if (entry.section === 'profile') await expect(owner.getByLabel('Bio', { exact: true })).toHaveValue('A thoughtful paragraph stays with me.');
  if (entry.section === 'personal') await expect(owner.getByLabel('Date of Birth', { exact: true })).toHaveValue('06/17/1992');
  if (entry.section === 'reading') {
    await expect(owner.getByRole('group', { name: 'Favorite Genres', exact: true }).getByRole('button', { name: 'Mystery', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(owner.getByRole('combobox', { name: 'Preferred reading time', exact: true })).toHaveText('Night');
  }
  if (entry.section === 'notifications') await expect(owner.getByLabel('End', { exact: true })).toHaveValue('06:15');
  if (entry.section === 'data') {
    expect(await owner.getByLabel('Import backup file').evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe(backup.name);
    await expect(owner.getByRole('heading', { name: 'Import preview', exact: true })).toBeVisible();
  }
}
async function keep(page: Page) {
  await expect(guard(page)).toBeVisible();
  await expect(guard(page).getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
  await guard(page).getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(guard(page)).toHaveCount(0);
}

test('Settings categories open an explicit account/editor URL and return focus to the current category', async ({ page }) => {
  await open(page);
  const categories = page.getByRole('navigation', { name: 'Settings categories', exact: true });
  await expect(categories).toBeVisible();
  await expect(page.getByLabel('Current password', { exact: true })).toHaveCount(0);
  await categories.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page).toHaveURL(/section=account/);
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'All settings', exact: true }).click();
  await expect(categories.getByRole('button', { name: 'Account', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });
  await categories.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByLabel('Display Name', { exact: true })).toHaveCount(1);
  await expect(categories.getByRole('button', { name: 'Profile', exact: true })).toHaveAttribute('aria-current', 'page');
});

for (const entry of entries) {
  test(`${entry.label}: same editor, draft and caret survive all boundaries and guarded section changes`, async ({ page }) => {
    await open(page, entry.section);
    const field = await fill(page, entry);
    const original = await field.elementHandle();
    const originalOwner = await editor(page, entry).elementHandle();
    const files = entry.section === 'data' ? await editor(page, entry).getByLabel('Import backup file').elementHandle() : null;
    await field.focus();
    if (entry.section !== 'notifications') await field.evaluate((input: HTMLInputElement) => input.setSelectionRange(2, 6));
    for (const width of [767, 768, 834, 1024, 1280, 320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await field.evaluate((node, prior) => node === prior, original)).toBe(true);
      expect(await editor(page, entry).evaluate((node, prior) => node === prior, originalOwner)).toBe(true);
      await expect(field).toBeFocused();
      if (entry.section !== 'notifications') expect(await field.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([2, 6]);
      if (files) expect(await editor(page, entry).getByLabel('Import backup file').evaluate((node, prior) => node === prior, files)).toBe(true);
      await expectDraft(page, entry);
    }
    await page.getByRole('button', { name: 'All settings', exact: true }).click(); await keep(page); await expectDraft(page, entry);
    await appBack(page); await expect(guard(page)).toBeVisible();
    await expect(guard(page).getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(guard(page)).toHaveCount(0); await expectDraft(page, entry);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('navigation', { name: 'Settings categories', exact: true }).getByRole('button', { name: entry.section === 'profile' ? 'Personal Info' : 'Profile', exact: true }).click();
    await keep(page); await expectDraft(page, entry);
    const nextLabel = entry.section === 'profile' ? 'Personal Info' : 'Profile';
    await page.getByRole('navigation', { name: 'Settings categories', exact: true }).getByRole('button', { name: nextLabel, exact: true }).click();
    await guard(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.locator('#settings-editor-title')).toHaveText(nextLabel);
    await expect(page.locator('#settings-editor-title')).toBeFocused();
    await page.getByRole('navigation', { name: 'Settings categories', exact: true }).getByRole('button', { name: entry.label, exact: true }).click();
    await fill(page, entry);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'All settings', exact: true }).click();
    await guard(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Settings categories', exact: true }).getByRole('button', { name: entry.label, exact: true })).toBeFocused();
    await expect(editor(page, entry)).toHaveCount(0);
  });
}

for (const entry of entries.filter(item => item.operation)) {
  test(`${entry.label}: deferred save blocks duplicates and leaving; rejection retains the draft and retry completes`, async ({ page }) => {
    await open(page, entry.section);
    const field = await fill(page, entry);
    await configure(page, entry.operation!, 'defer');
    await editor(page, entry).getByRole('button', { name: entry.save!, exact: true }).dblclick();
    await pending(page, entry.operation!);
    await expect(field).toBeDisabled();
    await page.getByRole('button', { name: 'All settings', exact: true }).click(); await appBack(page);
    await expect(guard(page)).toHaveCount(0); await expect(editor(page, entry)).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('navigation', { name: 'Settings categories', exact: true }).getByRole('button', { name: entry.section === 'profile' ? 'Personal Info' : 'Profile', exact: true }).click();
    expect((await calls(page, entry.operation!)).length).toBe(1);
    await settle(page, entry.operation!, 'reject');
    await expect(editor(page, entry).getByRole('alert')).toBeVisible();
    await expectDraft(page, entry);
    await configure(page, entry.operation!, 'resolve');
    await editor(page, entry).getByRole('button', { name: entry.save!, exact: true }).click();
    await expect.poll(async () => (await calls(page, entry.operation!)).length).toBe(2);
    if (entry.section === 'reading') await expect(editor(page, entry).getByRole('button', { name: 'Edit', exact: true })).toBeFocused();
    else await expect(field).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'All settings', exact: true }).click();
    await expect(guard(page)).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Settings categories', exact: true })).toBeVisible();
  });
}

test('Profile image chooser remains the same task on resize and a rejected upload keeps the image plus text draft', async ({ page }) => {
  const entry = entries[0]; await open(page, 'profile'); await fill(page, entry);
  await configure(page, 'avatar-pick', 'defer'); await configure(page, 'avatar-upload', 'defer');
  await page.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose Profile Photo', exact: true }); const original = await picker.elementHandle();
  await picker.getByRole('button', { name: 'Photo Library', exact: true }).click(); await pending(page, 'avatar-pick');
  await page.keyboard.press('Escape'); await appBack(page); await expect(picker).toBeVisible();
  expect((await calls(page, 'avatar-pick')).length).toBe(1);
  for (const width of [767, 768, 834, 1024, 1280, 390]) { await page.setViewportSize({ width, height: 900 }); expect(await picker.evaluate((node, prior) => node === prior, original)).toBe(true); }
  await settle(page, 'avatar-pick', 'resolve'); await pending(page, 'avatar-upload'); await expect(picker).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Profile Picture', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'All settings', exact: true }).click(); await expect(guard(page)).toHaveCount(0);
  await settle(page, 'avatar-upload', 'reject'); await expect(editor(page, entry).getByRole('alert')).toContainText('Fixture avatar-upload failed');
  await expectDraft(page, entry); await expect(page.getByRole('button', { name: 'Discard selected photo', exact: true })).toBeVisible();
  await configure(page, 'avatar-upload', 'resolve'); await page.getByRole('button', { name: 'Retry photo upload', exact: true }).click();
  await expect.poll(async () => (await calls(page, 'avatar-save')).length).toBe(1);
  await expect(page.getByRole('button', { name: 'Remove profile photo', exact: true })).toBeVisible(); await expectDraft(page, entry);
});

test('Profile browser file chooser uses the actual web fallback and uploads one selected file', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/settings?section=profile');
  await page.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Photo Library', exact: true }).click();
  await (await chooser).setFiles(photo);
  await expect.poll(async () => (await calls(page, 'avatar-save')).length).toBe(1);
  expect((await calls(page, 'avatar-upload')).length).toBe(1);
  await expect(page.getByRole('button', { name: 'Remove profile photo', exact: true })).toBeVisible();
});

test('Personal date text and the open calendar retain node, selection and Back ownership across resize', async ({ page }) => {
  const entry = entries[1]; await open(page, 'personal'); await fill(page, entry);
  const trigger = page.getByRole('button', { name: 'Choose date: Date of Birth', exact: true });
  await trigger.click(); const panel = page.locator('[data-date-picker-presentation]'); const original = await panel.elementHandle();
  await page.keyboard.press('ArrowRight'); const focused = await page.locator(':focus').elementHandle();
  for (const width of [767, 768, 834, 1024, 1280, 390]) { await page.setViewportSize({ width, height: 900 }); expect(await panel.evaluate((node, prior) => node === prior, original)).toBe(true); expect(await page.evaluate(prior => document.activeElement === prior, focused)).toBe(true); }
  await appBack(page); await expect(panel).toHaveCount(0); await expect(trigger).toBeFocused(); await expectDraft(page, entry);
  await expect(guard(page)).toHaveCount(0); await appBack(page); await keep(page);
});

test('Data import preview and file survive rejected commit and cannot be replaced while importing', async ({ page }) => {
  const entry = entries[4]; await open(page, 'data'); await fill(page, entry);
  const owner = editor(page, entry); await configure(page, 'import-commit', 'defer');
  await owner.getByRole('button', { name: 'Import 2 records', exact: true }).dblclick(); await pending(page, 'import-commit');
  await expect(owner.getByLabel('Import backup file')).toBeDisabled(); await page.setViewportSize({ width: 834, height: 1112 });
  await page.getByRole('button', { name: 'All settings', exact: true }).click(); await expect(guard(page)).toHaveCount(0);
  expect((await calls(page, 'import-commit')).length).toBe(1); await settle(page, 'import-commit', 'reject');
  await expect(owner.getByRole('alert').filter({ hasText: 'Fixture import-commit failed' })).toBeVisible(); await expectDraft(page, entry);
  await configure(page, 'import-commit', 'resolve'); await owner.getByRole('button', { name: 'Import 2 records', exact: true }).click();
  await expect(owner.getByRole('heading', { name: 'Import preview', exact: true })).toHaveCount(0);
  expect(await owner.getByLabel('Import backup file').evaluate((input: HTMLInputElement) => input.files?.length)).toBe(0);
  await page.getByRole('button', { name: 'All settings', exact: true }).click(); await expect(guard(page)).toHaveCount(0);
});

test('Privacy pending immediate save blocks leaving and restores the previous value after rejection', async ({ page }) => {
  await open(page, 'privacy'); const toggle = page.getByRole('switch', { name: 'Public Profile', exact: true }); await expect(toggle).toBeChecked();
  await configure(page, 'privacy-save', 'defer'); await toggle.click(); await pending(page, 'privacy-save'); await expect(toggle).not.toBeChecked(); await expect(toggle).toBeDisabled();
  await page.getByRole('button', { name: 'All settings', exact: true }).click(); await appBack(page); await expect(guard(page)).toHaveCount(0); await expect(toggle).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 }); await settle(page, 'privacy-save', 'reject'); await expect(toggle).toBeChecked(); await expect(toggle).toBeEnabled();
  await configure(page, 'privacy-save', 'resolve'); await toggle.click(); await expect(toggle).not.toBeChecked(); await expect(toggle).toBeEnabled();
  expect((await calls(page, 'privacy-save')).length).toBe(2);
});

test('Account replacement invalidates a pending photo selection before it can upload for the next reader', async ({ page }) => {
  await open(page, 'profile'); await configure(page, 'avatar-pick', 'defer');
  await page.getByRole('button', { name: 'Choose Photo', exact: true }).click(); await page.getByRole('button', { name: 'Photo Library', exact: true }).click(); await pending(page, 'avatar-pick');
  await page.evaluate(() => window.settingsContinuity!.setAccount('reader-next'));
  await expect(page.getByRole('dialog', { name: 'Choose Profile Photo', exact: true })).toHaveCount(0);
  await settle(page, 'avatar-pick', 'resolve'); expect((await calls(page, 'avatar-upload')).length).toBe(0);
  await expect(page.getByLabel('Display Name', { exact: true })).toHaveValue('Alex Reader');
});

test('Changing accounts closes an obsolete dirty confirmation without transferring its draft', async ({ page }) => {
  await open(page, 'profile'); await fill(page, entries[0]);
  await page.getByRole('button', { name: 'All settings', exact: true }).click(); await expect(guard(page)).toBeVisible();
  await page.evaluate(() => window.settingsContinuity!.setAccount('reader-next'));
  await expect(guard(page)).toHaveCount(0);
  await expect(page.getByLabel('Display Name', { exact: true })).toHaveValue('Alex Reader');
  await page.getByRole('button', { name: 'All settings', exact: true }).click(); await expect(guard(page)).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Settings categories', exact: true })).toBeVisible();
});

test('Sign out stays visible during pending work and supports an explicit retry after rejection', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign Out', exact: true });
  await configure(page, 'sign-out', 'defer'); await dialog.getByRole('button', { name: 'Sign Out', exact: true }).dblclick(); await pending(page, 'sign-out');
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await appBack(page); await expect(dialog).toBeVisible();
  expect((await calls(page, 'sign-out')).length).toBe(1);
  await settle(page, 'sign-out', 'reject'); await expect(dialog.getByRole('alert')).toContainText('Failed to sign out');
  await configure(page, 'sign-out', 'resolve'); await dialog.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page).toHaveURL(/\/auth/); expect((await calls(page, 'sign-out')).length).toBe(2);
});

test('Personal location keeps fields locked through its existing automatic save and rejected writes keep the coordinates', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/reverse**', route => route.fulfill({ json: { address: { city: 'Brooklyn', country: 'United States' } } }));
  await open(page, 'personal'); await configure(page, 'personal-save', 'defer');
  await page.getByRole('button', { name: 'Use Current Location', exact: true }).click(); await pending(page, 'personal-save');
  await expect(page.getByLabel('First Name', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Choose date: Date of Birth', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 834, height: 1112 }); await page.getByRole('button', { name: 'All settings', exact: true }).click(); await expect(guard(page)).toHaveCount(0);
  await settle(page, 'personal-save', 'reject'); await expect(editor(page, entries[1]).getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('First Name', { exact: true })).toBeEnabled();
  expect((await calls(page, 'personal-save'))[0].payload).toMatchObject({ latitude: 40.6782, longitude: -73.9442 });
});

for (const surface of ['Menu', 'Sidebar', 'Native tabs'] as const) {
  test(`${surface}: shell departure respects the actual Settings draft and pending save`, async ({ page }) => {
    await open(page, 'profile', { width: surface === 'Sidebar' ? 1280 : 390, height: 900 });
    await fill(page, entries[0]);
    const menu = page.getByRole('dialog', { name: 'Your reading space', exact: true });
    const destination = () => (surface === 'Menu' ? menu : page.getByRole('navigation', { name: 'Primary navigation', exact: true })).getByRole('link', { name: 'Library', exact: true });
    const show = async () => {
      if (surface === 'Menu') await page.getByRole('button', { name: 'Menu', exact: true }).click();
      // The production shell intentionally hides tabs while editing. End editing
      // through a real pointer action before testing the restored destination.
      if (surface === 'Native tabs') await page.locator('#settings-editor-title').click();
    };
    const close = async () => { if (surface === 'Menu') await menu.getByRole('button', { name: 'Close', exact: true }).click(); };
    await show(); await destination().click(); await keep(page);
    await expect(page).toHaveURL(/section=profile/);
    if (surface === 'Menu') await expect(menu).toBeVisible();
    await close(); await expectDraft(page, entries[0]);
    await configure(page, 'profile-save', 'defer'); await editor(page, entries[0]).getByRole('button', { name: 'Save Changes', exact: true }).click(); await pending(page, 'profile-save');
    await show(); await destination().click();
    await expect(guard(page)).toHaveCount(0); await expect(page).toHaveURL(/section=profile/);
    if (surface === 'Menu') await expect(menu).toBeVisible();
    await close(); await settle(page, 'profile-save', 'reject'); await expectDraft(page, entries[0]);
    await show(); await destination().click(); await guard(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page).toHaveURL(/\/my-books$/); await expect(page.getByRole('heading', { name: 'Outside the Settings fixture', exact: true })).toBeVisible();
    expect((await calls(page, 'profile-save')).length).toBe(1);
  });
}

for (const surface of ['Menu', 'Sidebar'] as const) {
  test(`${surface}: shell sign out uses the Settings discard and sign-out tasks`, async ({ page }) => {
    await open(page, 'profile', { width: surface === 'Sidebar' ? 1280 : 390, height: 900 }); await fill(page, entries[0]);
    const menu = page.getByRole('dialog', { name: 'Your reading space', exact: true });
    if (surface === 'Menu') await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const source = surface === 'Menu' ? menu : page.getByRole('navigation', { name: 'Primary navigation', exact: true });
    await source.getByRole('button', { name: 'Sign out', exact: true }).click(); await keep(page);
    expect((await calls(page, 'sign-out')).length).toBe(0);
    await source.getByRole('button', { name: 'Sign out', exact: true }).click(); await guard(page).getByRole('button', { name: 'Discard changes', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign Out', exact: true }); await expect(dialog).toBeVisible();
    await expect(menu).toHaveCount(0); expect((await calls(page, 'sign-out')).length).toBe(0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expectDraft(page, entries[0]);
  });
}

const visualEntries = [...entries, { section: 'privacy', label: 'Privacy', field: '', value: '' }, { section: 'app', label: 'App Preferences', field: '', value: '' }];
for (const [name, viewport, query] of [
  ['narrow', { width: 320, height: 844 }, ''],
  ['tablet-large-text', { width: 834, height: 1112 }, 'text=200'],
  ['tablet-touch-large-text', { width: 834, height: 1112 }, 'text=200'],
  ['short-height', { width: 390, height: 480 }, ''],
] as const) {
  test(`Settings actual forms and actions remain reachable: ${name}`, async ({ page }, info) => {
    test.setTimeout(180_000);
    if (name === 'tablet-touch-large-text') await coarsePointer(page);
    for (const entry of visualEntries) {
      await open(page, entry.section, viewport, query);
      const owner = editor(page, entry);
      const field = entry.field ? await fill(page, entry) : entry.section === 'privacy'
        ? owner.getByRole('switch', { name: 'Public Profile', exact: true }) : owner.getByRole('button', { name: 'Light Mode', exact: true });
      const fonts = await page.evaluate(async () => Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(async family => {
        const faces = await document.fonts.load(`16px "${family}"`); return { family, loaded: faces.filter(face => face.status === 'loaded').length };
      })));
      for (const font of fonts) expect(font.loaded, `${font.family} must be a loaded declared face`).toBeGreaterThan(0);
      await info.attach(`${name}-${entry.section}-fonts`, { body: JSON.stringify(fonts), contentType: 'application/json' });
      const geometry = await owner.evaluate(element => {
        const boundary = element.getBoundingClientRect();
        return { overflow: element.scrollWidth - element.clientWidth, width: boundary.width,
          protruding: [...element.querySelectorAll('*')].map(node => ({ node, box: node.getBoundingClientRect() }))
            .filter(({ box }) => box.width > 0 && (box.right > boundary.right + 1 || box.left < boundary.left - 1))
            .map(({ node, box }) => ({ tag: node.tagName, label: node.getAttribute('aria-label') || node.textContent?.slice(0, 90), width: box.width, left: box.left, right: box.right })).slice(0, 15) };
      });
      await info.attach(`${name}-${entry.section}-geometry`, { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
      expect(geometry.overflow, `${entry.label} must not overflow horizontally`).toBeLessThanOrEqual(1);
      await reveal(field); await usable(field);
      if (entry.field && entry.section !== 'notifications') expect((await field.boundingBox())!.width).toBeGreaterThanOrEqual(180);
      const writingPath = info.outputPath(`${name}-${entry.section}-writing.png`);
      await page.screenshot({ path: writingPath, fullPage: true }); await info.attach(`${entry.section}-writing`, { path: writingPath, contentType: 'image/png' });
      const action = entry.save ? owner.getByRole('button', { name: entry.save, exact: true }) : entry.section === 'data'
        ? owner.getByRole('button', { name: 'Import 2 records', exact: true }) : entry.section === 'account'
          ? owner.getByRole('button', { name: 'Update password', exact: true }) : field;
      await reveal(action);
      // The real password form requires an external CAPTCHA, which this fixture
      // does not supply. Its disabled action must fit but must reject pointers.
      if (entry.section === 'account') { await expect(action).toBeDisabled(); await expect(action).toBeInViewport({ ratio: 1 }); }
      else await usable(action);
      const actionsPath = info.outputPath(`${name}-${entry.section}-actions.png`);
      await page.screenshot({ path: actionsPath, fullPage: true }); await info.attach(`${entry.section}-actions`, { path: actionsPath, contentType: 'image/png' });
      if (name === 'tablet-touch-large-text' && ['profile', 'personal'].includes(entry.section)) {
        await owner.getByRole('button', { name: entry.section === 'profile' ? 'Choose Photo' : 'Choose date: Date of Birth', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: entry.section === 'profile' ? 'Choose Profile Photo' : 'Choose date: Date of Birth', exact: true });
        await expect(dialog).toHaveAttribute('data-presentation', 'sheet');
        const close = dialog.getByRole('button', { name: entry.section === 'personal' ? 'Close calendar' : 'Close', exact: true }); await reveal(close); await usable(close);
        const overlap = await dialog.evaluate(element => {
          const overlay = document.querySelector('[data-shell-scroll-top]');
          if (!overlay || overlay.getClientRects().length === 0) return null;
          const a = element.getBoundingClientRect(); const b = overlay.getBoundingClientRect();
          const left = Math.max(a.left, b.left); const right = Math.min(a.right, b.right);
          const top = Math.max(a.top, b.top); const bottom = Math.min(a.bottom, b.bottom);
          if (right <= left || bottom <= top) return null;
          return element.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2));
        });
        expect(overlap, 'A shell scroll control must not intercept an open task').not.toBe(false);
        const nestedPath = info.outputPath(`${name}-${entry.section}-nested.png`); await page.screenshot({ path: nestedPath, fullPage: true });
        await info.attach(`${entry.section}-nested`, { path: nestedPath, contentType: 'image/png' });
      }
    }
  });
}
async function reveal(control: Locator) { await control.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })); }
async function usable(control: Locator) {
  await expect(control).toBeInViewport({ ratio: 1 });
  await expect.poll(() => control.evaluate(element => {
    const box = element.getBoundingClientRect();
    return [0.15, 0.5, 0.85].map(fraction => { const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height * fraction); return hit === element || element.contains(hit); });
  }), { message: 'The visible control must receive pointer input across its height' }).toEqual([true, true, true]);
}
async function coarsePointer(page: Page) {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window); const overrides = new Map<string, MediaQueryList>();
    const coarse = ['(pointer: coarse)', '(any-pointer: coarse)']; const fine = ['(pointer: fine)', '(any-pointer: fine)', '(hover: hover)', '(any-hover: hover)'];
    window.matchMedia = query => {
      if (!coarse.includes(query) && !fine.includes(query)) return original(query);
      if (!overrides.has(query)) overrides.set(query, Object.assign(new EventTarget(), { media: query, matches: coarse.includes(query), onchange: null }) as MediaQueryList);
      return overrides.get(query)!;
    };
  });
}
export type FixtureAPI = SettingsContinuityAPI;
