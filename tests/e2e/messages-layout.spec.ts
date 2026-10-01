import { expect, test, type Page, type Locator } from '@playwright/test';
import type { MessagesLayoutAPI } from '../fixtures/messages-layout/main';
import type { Operation } from '../fixtures/messages-layout/state';
const diagnostics = new WeakMap<Page, { errors: string[]; warnings: string[] }>();
test.beforeEach(async ({ page }) => {
  const log = { errors: [] as string[], warnings: [] as string[] };
  diagnostics.set(page, log);
  page.on('pageerror', error => log.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') log.warnings.push(message.text()); });
});
test.afterEach(async ({ page }, info) => {
  const log = diagnostics.get(page)!;
  await info.attach('browser-diagnostics', { body: JSON.stringify(log, null, 2), contentType: 'application/json' });
  const requests = await page.evaluate(() => window.messagesLayout?.snapshot()).catch(() => null);
  await info.attach('request-evidence', { body: JSON.stringify(requests, null, 2), contentType: 'application/json' });
  expect(log.errors).toEqual([]);
  expect(log.warnings.filter(message => /DialogContent.*(DialogTitle|Description)|Missing.*Description/i.test(message))).toEqual([]);
});
declare global { interface Window { messagesLayout?: MessagesLayoutAPI; retainedComposer?: HTMLTextAreaElement; retainedFile?: HTMLInputElement; retainedGif?: HTMLInputElement } }
const attachment = { name: 'reading.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') };
async function configure(page: Page, operation: Operation, mode: 'resolve' | 'reject' | 'defer') {
  await page.evaluate(({ operation, mode }) => window.messagesLayout!.configure(operation, mode), { operation, mode });
}
async function count(page: Page, operation: Operation, expected: number) {
  await expect.poll(() => page.evaluate(operation => window.messagesLayout!.snapshot().calls.filter(call => call.operation === operation).length, operation)).toBe(expected);
}
async function settle(page: Page, operation: Operation, outcome: 'resolve' | 'reject') {
  await expect.poll(() => page.evaluate(operation => window.messagesLayout!.snapshot().pending.includes(operation), operation)).toBe(true);
  await page.evaluate(({ operation, outcome }) => window.messagesLayout!.settle(operation, outcome), { operation, outcome });
}
async function inbox(page: Page, query = '', viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/messages${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(page.getByRole('textbox', { name: 'Search messages', exact: true })).toBeVisible();
}

async function ready(page: Page, query = '', viewport = { width: 390, height: 844 }) {
  await inbox(page, query, viewport);
  await page.getByRole('button', { name: 'Open conversation with Taylor Lane', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'Message', exact: true });
  await expect(field).toBeVisible();
  return field;
}

async function reply(page: Page) {
  const actions = page.getByRole('button', { name: 'Message actions', exact: true }).last();
  await actions.click();
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel reply', exact: true })).toBeVisible();
}
async function usable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  expect(await control.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const hits = [rect.top + 3, rect.top + rect.height / 2, rect.bottom - 3].map(y => {
      const hit = document.elementFromPoint(rect.x + rect.width / 2, y);
      return hit === node || node.contains(hit);
    });
    const clipping: string[] = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
      const left = bounds.left + parent.clientLeft, top = bounds.top + parent.clientTop;
      if (/auto|scroll|hidden|clip/.test(style.overflowY) && (rect.top < top - 1 || rect.bottom > top + parent.clientHeight + 1)) clipping.push(`${parent.tagName} vertical ${Math.round(rect.top)}..${Math.round(rect.bottom)} outside ${Math.round(top)}..${Math.round(top + parent.clientHeight)}`);
      if (/auto|scroll|hidden|clip/.test(style.overflowX) && (rect.left < left - 1 || rect.right > left + parent.clientWidth + 1)) clipping.push(`${parent.tagName} horizontal`);
    }
    return { inside: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
      hits, clipping };
  })).toEqual({ inside: true, hits: [true, true, true], clipping: [] });
}

test('composer survives the compact split-pane breakpoint with its actual node and draft', async ({ page }) => {
  await inbox(page);
  const search = page.getByRole('textbox', { name: 'Search messages', exact: true, includeHidden: true });
  await search.fill('Taylor');
  await page.getByRole('button', { name: 'Open conversation with Taylor Lane', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'Message', exact: true });
  await expect(field).toBeVisible();
  await reply(page);
  await page.locator('input[type=file]').setInputFiles(attachment);
  await field.fill('Keep this unfinished thought');
  await field.focus();
  await field.evaluate(node => { window.retainedComposer = node as HTMLTextAreaElement; window.retainedComposer.setSelectionRange(5, 12); });
  await page.locator('input[type=file]').evaluate(node => { window.retainedFile = node as HTMLInputElement; });
  for (const width of [767, 768, 834, 1024, 1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(field).toHaveValue('Keep this unfinished thought');
    await expect(field).toBeFocused();
    expect(await field.evaluate(node => ({ same: node === window.retainedComposer, start: (node as HTMLTextAreaElement).selectionStart, end: (node as HTMLTextAreaElement).selectionEnd }))).toEqual({ same: true, start: 5, end: 12 });
    expect(await page.locator('input[type=file]').evaluate(node => ({ same: node === window.retainedFile, name: (node as HTMLInputElement).files?.[0]?.name }))).toEqual({ same: true, name: 'reading.png' });
    await expect(page.getByRole('button', { name: 'Cancel reply', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove attached media', exact: true })).toBeVisible();
    await expect(search).toHaveValue('Taylor');
  }
});

test('route entry retries a rejected reader lookup and a late result cannot replace a manual conversation choice', async ({ page }) => {
  await inbox(page, '?entry=reader');
  await count(page, 'open-conversation', 1);
  await expect(page.getByRole('status').filter({ hasText: 'Opening conversation' })).toBeVisible();
  await settle(page, 'open-conversation', 'reject');
  await expect(page.getByRole('alert').filter({ hasText: "Couldn't open this conversation" })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await count(page, 'open-conversation', 2);
  await page.getByRole('button', { name: 'Open conversation with Jules Avery', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'Message', exact: true });
  await field.fill('Keep the chosen conversation');
  await settle(page, 'open-conversation', 'resolve');
  await expect(page.getByRole('heading', { name: 'Jules Avery', exact: true })).toBeVisible();
  await expect(field).toHaveValue('Keep the chosen conversation');
  await page.goto('/messages?entry=existing');
  await expect(field).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Taylor Lane', exact: true })).toBeVisible();
  await count(page, 'open-conversation', 0);
});

test('actual inbox and thread read errors recover without replacing an already loaded draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/messages?initialReadFailure');
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(page.getByRole('alert').filter({ hasText: "We couldn't load conversations" })).toBeVisible();
  await configure(page, 'conversations-read', 'resolve');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await configure(page, 'thread-read', 'reject');
  await page.getByRole('button', { name: 'Open conversation with Taylor Lane', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: "We couldn't load this conversation" })).toBeVisible();
  await configure(page, 'thread-read', 'resolve');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'Message', exact: true });
  await field.fill('Loaded task survives a refresh error');
  await field.evaluate(node => { window.retainedComposer = node as HTMLTextAreaElement; });
  await configure(page, 'thread-read', 'reject');
  await page.evaluate(() => window.messagesLayout!.refresh());
  await expect(page.getByRole('alert').filter({ hasText: "We couldn't load this conversation" })).toBeVisible();
  await expect(field).toHaveValue('Loaded task survives a refresh error');
  expect(await field.evaluate(node => node === window.retainedComposer)).toBe(true);
});

test('offline writing stays available while sending and media are disabled; online reentry restores the written draft', async ({ page }) => {
  const field = await ready(page, '?offline');
  await field.fill('A thought written offline');
  await expect(field).toBeEnabled();
  for (const name of ['Send message', 'Attach image or GIF', 'Search GIFs']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await field.press('Enter');
  await count(page, 'direct-send', 0);
  await expect(field).toHaveValue('A thought written offline');
  await ready(page);
  await expect(field).toHaveValue('A thought written offline');
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
});

test('tablet composer clears the shell and viewport at200percent with timer', async ({ page }, info) => {
  const field = await ready(page, '?text=200&timer', { width: 834, height: 1112 });
  await field.fill('Tablet reading conversation');
  await page.screenshot({ path: info.outputPath('tablet-message.png'), fullPage: true });
  const send = page.getByRole('button', { name: 'Send message', exact: true });
  const box = await send.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(835);
  expect(box!.y + box!.height).toBeLessThanOrEqual(1113);
});

test('GIF task retains search node and query across pane reflow and Back returns to its opener', async ({ page }) => {
  const field = await ready(page, '?runtime=android');
  await field.fill('Draft behind GIF picker');
  const opener = page.getByRole('button', { name: 'Search GIFs', exact: true });
  await opener.click();
  const gif = page.getByRole('dialog', { name: 'Search GIFs', exact: true });
  const search = gif.getByRole('textbox', { name: 'Search GIFs', exact: true });
  await search.fill('reading quietly');
  await search.evaluate(node => { window.retainedGif = node as HTMLInputElement; });
  for (const width of [768, 834, 1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(search).toHaveValue('reading quietly');
    expect(await search.evaluate(node => node === window.retainedGif)).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => window.messagesLayout!.native().active)).toBe(1);
  await page.evaluate(() => window.messagesLayout!.back());
  await expect(gif).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(field).toHaveValue('Draft behind GIF picker');
});

test('pending upload and send retain ownership through resize and app Back; failure retries one request', async ({ page }) => {
  const field = await ready(page, '?runtime=android');
  await field.fill('First draft');
  await page.locator('input[type=file]').setInputFiles(attachment);
  await configure(page, 'direct-upload', 'defer');
  await configure(page, 'direct-send', 'defer');
  const send = page.getByRole('button', { name: 'Send message', exact: true });
  await send.click();
  await count(page, 'direct-upload', 1);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.messagesLayout!.back());
  await field.fill('A newer thought');
  await field.press('Enter');
  await count(page, 'direct-upload', 1);
  await expect(send).toBeDisabled();
  await settle(page, 'direct-upload', 'resolve');
  await count(page, 'direct-send', 1);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.evaluate(() => window.messagesLayout!.back());
  await settle(page, 'direct-send', 'reject');
  await expect(field).toHaveValue('A newer thought');
  await expect(page.getByRole('button', { name: 'Remove attached media', exact: true })).toBeVisible();
  await expect(field).toHaveAccessibleDescription(/Message wasn't sent/);
  await field.fill('First draft');
  await configure(page, 'direct-send', 'resolve');
  await send.click();
  await count(page, 'direct-send', 2);
  await count(page, 'direct-upload', 1);
  await expect(field).toHaveValue('');
  const calls = await page.evaluate(() => window.messagesLayout!.snapshot().calls.filter(call => call.operation === 'direct-send'));
  expect(calls[0].payload).toEqual(calls[1].payload);
});

test('reading older messages keeps scroll through refresh and incoming content until Latest messages', async ({ page }) => {
  const field = await ready(page);
  await field.fill('Thought while rereading');
  const history = page.getByRole('region', { name: 'Message history', exact: true });
  await history.evaluate(node => { node.scrollTop = 120; node.dispatchEvent(new Event('scroll')); });
  await expect(page.getByRole('button', { name: 'Latest messages', exact: true })).toBeVisible();
  const previous = await history.evaluate(node => node.scrollTop);
  await configure(page, 'thread-read', 'defer');
  await page.evaluate(() => window.messagesLayout!.refresh());
  await expect(field).toHaveValue('Thought while rereading');
  await settle(page, 'thread-read', 'resolve');
  await configure(page, 'thread-read', 'resolve');
  await page.evaluate(() => window.messagesLayout!.incoming());
  await expect(page.getByText('A fresh thought 1', { exact: true })).toHaveCount(1);
  expect(await history.evaluate(node => node.scrollTop)).toBeCloseTo(previous, 0);
  await page.getByRole('button', { name: 'Latest messages', exact: true }).click();
  await expect.poll(() => history.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(2);
  await expect(field).toHaveValue('Thought while rereading');
  await configure(page, 'thread-read', 'reject');
  await page.evaluate(() => window.messagesLayout!.refresh());
  await expect(page.getByRole('alert').filter({ hasText: "We couldn't load this conversation" })).toBeVisible();
  await expect(field).toHaveValue('Thought while rereading');
  await expect(page.getByText('A fresh thought 1', { exact: true })).toHaveCount(1);
});

test('conversation actions are keyboard reachable and retain pending and rejected outcomes across reflow', async ({ page }) => {
  await inbox(page);
  const opener = page.getByRole('button', { name: 'Actions for conversation with Jules Avery', exact: true });
  await opener.focus(); await opener.press('Enter');
  const group = page.getByRole('group', { name: 'Conversation actions for Jules Avery', exact: true });
  await expect(group).toBeVisible();
  await configure(page, 'mute', 'defer');
  await group.getByRole('button', { name: 'Mute', exact: true }).click();
  await count(page, 'mute', 1);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(group.getByRole('button', { name: 'Updating', exact: false })).toBeDisabled();
  await settle(page, 'mute', 'reject');
  await expect(page.getByRole('alert').filter({ hasText: 'Could not change notifications' })).toBeVisible();
  await configure(page, 'mute', 'resolve');
  await group.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(group.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
  await group.getByRole('button', { name: 'Mark as read', exact: true }).click();
  await count(page, 'mark-read', 1);
  await expect(group.getByRole('button', { name: 'Mark as read', exact: true })).toBeDisabled();
  await configure(page, 'hide', 'defer');
  await group.getByRole('button', { name: 'Hide conversation', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await count(page, 'hide', 1);
  await settle(page, 'hide', 'reject');
  await expect(page.getByRole('alert').filter({ hasText: 'Could not hide' })).toBeVisible();
  await configure(page, 'hide', 'resolve');
  await group.getByRole('button', { name: 'Hide conversation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open conversation with Jules Avery', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Search messages', exact: true })).toBeFocused();
});

test('Back keeps or explicitly discards transient reply and files, restores row focus and keeps text per conversation', async ({ page }) => {
  const field = await ready(page, '?runtime=android');
  await field.fill('Taylor draft retained');
  await reply(page);
  await page.locator('input[type=file]').setInputFiles(attachment);
  await page.getByRole('button', { name: 'Back to messages', exact: true }).click();
  const guard = page.getByRole('dialog', { name: 'Leave this conversation?', exact: true });
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: 'Keep composing', exact: true }).click();
  await expect(field).toHaveValue('Taylor draft retained');
  await expect(page.getByRole('button', { name: 'Cancel reply', exact: true })).toBeVisible();
  await page.evaluate(() => window.messagesLayout!.back());
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: 'Leave conversation', exact: true }).click();
  const row = page.getByRole('button', { name: 'Open conversation with Taylor Lane', exact: true });
  await expect(row).toBeFocused();
  await page.getByRole('button', { name: 'Open conversation with Jules Avery', exact: true }).click();
  await expect(field).toHaveValue('');
  await field.fill('Jules draft');
  await page.getByRole('button', { name: 'Back to messages', exact: true }).click();
  await row.click();
  await expect(field).toHaveValue('Taylor draft retained');
  await expect(page.getByRole('button', { name: 'Cancel reply', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove attached media', exact: true })).toHaveCount(0);
});

test('split-pane profile departure respects transient drafts and pending send ownership', async ({ page }) => {
  const field = await ready(page, '', { width: 1280, height: 900 });
  await field.fill('Draft before profile');
  await page.locator('input[type=file]').setInputFiles(attachment);
  const profile = page.getByRole('region', { name: 'Inbox', exact: true }).getByRole('button', { name: 'Open Taylor Lane profile', exact: true });
  await profile.click();
  const guard = page.getByRole('dialog', { name: 'Leave this conversation?', exact: true });
  await guard.getByRole('button', { name: 'Keep composing', exact: true }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await expect(field).toHaveValue('Draft before profile');
  await expect(page.getByRole('button', { name: 'Remove attached media', exact: true })).toBeVisible();
  await configure(page, 'direct-upload', 'defer');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await count(page, 'direct-upload', 1);
  await profile.click();
  await expect(page).toHaveURL(/\/messages$/);
  await expect(guard).toHaveCount(0);
  await settle(page, 'direct-upload', 'reject');
  await profile.click();
  await guard.getByRole('button', { name: 'Leave conversation', exact: true }).click();
  await expect(page).toHaveURL(/\/users\/reader-taylor$/);
});

test('message deletion keeps its confirmation pending, retries rejection and returns to a surviving composer', async ({ page }) => {
  const field = await ready(page, '?runtime=android');
  await field.fill('Unsent thought remains');
  const ownMessage = page.locator('[data-message-reply-surface]').filter({ hasText: 'Reading note 22:' });
  await ownMessage.locator('..').getByRole('button', { name: 'Message actions', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete message?', exact: true });
  await configure(page, 'delete-message', 'defer');
  await dialog.getByRole('button', { name: 'Delete message', exact: true }).click();
  await count(page, 'delete-message', 1);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.messagesLayout!.back());
  await expect(dialog).toBeVisible();
  await settle(page, 'delete-message', 'reject');
  await expect(dialog.getByRole('alert')).toHaveText(/wasn't deleted/);
  await configure(page, 'delete-message', 'resolve');
  await dialog.getByRole('button', { name: 'Delete message', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Unsent thought remains');
  await expect(page.getByRole('region', { name: 'Message history', exact: true }).getByText('Message deleted', { exact: true })).toBeVisible();
  await count(page, 'delete-message', 2);
});

test('compact conversation options expose a real block confirmation and failed writes stay retryable', async ({ page }) => {
  const field = await ready(page, '?runtime=android');
  const options = page.getByRole('button', { name: 'Conversation options', exact: true });
  await options.click();
  await page.getByRole('button', { name: 'Block reader', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Block Taylor Lane?', exact: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  const expandedBlock = page.getByRole('button', { name: 'Block', exact: true });
  await expect(expandedBlock).toBeFocused();
  await expandedBlock.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  await configure(page, 'block', 'defer');
  await dialog.getByRole('button', { name: 'Block reader', exact: true }).click();
  await count(page, 'block', 1);
  await page.evaluate(() => window.messagesLayout!.back());
  await expect(dialog).toBeVisible();
  await settle(page, 'block', 'reject');
  await expect(dialog.getByRole('alert')).toContainText('Fixture block failed');
  await configure(page, 'block', 'resolve');
  await dialog.getByRole('button', { name: 'Block reader', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(field).toBeDisabled();
  await expect(options).toBeFocused();
});

test('visual viewport contraction keeps the same composer above the simulated keyboard and timer', async ({ page }) => {
  const field = await ready(page, '?timer&runtime=android');
  await field.fill('Writing with the keyboard');
  await field.focus();
  await field.evaluate(node => { window.retainedComposer = node as HTMLTextAreaElement; });
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: 440 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => {
    const box = await page.getByRole('button', { name: 'Send message', exact: true }).boundingBox();
    return box ? box.y + box.height : Infinity;
  }).toBeLessThanOrEqual(441);
  expect(await field.evaluate(node => node === window.retainedComposer)).toBe(true);
  await expect(field).toBeFocused();
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, 'height');
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(field).toHaveValue('Writing with the keyboard');
});

test('touch row swipe reveals its visible actions and canceled contacts preserve navigation', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Real contact input is injected through Chromium CDP; native and other-engine gestures remain device acceptance.');
  await inbox(page);
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const row = page.getByRole('button', { name: 'Open conversation with Taylor Lane', exact: true });
  const group = page.getByRole('group', { name: 'Conversation actions for Taylor Lane', exact: true });
  const box = (await row.boundingBox())!;
  const x = box.x + box.width - 15, y = box.y + box.height / 2;
  const start = () => session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] });
  const move = () => session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x - 85, y }] });
  await start(); await move();
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(group).toHaveCount(0);
  await start(); await move();
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: x - 85, y }, { id: 2, x, y: y + 25 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(group).toHaveCount(0);
  await start(); await move();
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(group).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveCount(0);
  for (const control of [page.getByRole('button', { name: 'Actions for conversation with Taylor Lane', exact: true }), row]) {
    const rect = (await control.boundingBox())!;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
});

test('touch reply owns only its interior horizontal contact and never leaves the conversation', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Real contact input is injected through Chromium CDP; native and other-engine gestures remain device acceptance.');
  await ready(page);
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const content = page.getByRole('region', { name: 'Message history', exact: true }).getByText('Have you reached the next chapter?', { exact: true });
  await content.scrollIntoViewIfNeeded();
  const box = (await content.boundingBox())!;
  const x = Math.max(30, box.x + 10), y = box.y + box.height / 2;
  const start = () => session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] });
  const move = () => session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x + 85, y }] });
  const cancel = page.getByRole('button', { name: 'Cancel reply', exact: true });
  await start(); await move();
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(cancel).toHaveCount(0);
  await start(); await move();
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: x + 85, y }, { id: 2, x, y: y + 25 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(cancel).toHaveCount(0);
  await content.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  await start(); await move();
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(cancel).toHaveCount(0);
  await page.evaluate(() => getSelection()!.removeAllRanges());
  await start(); await move();
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(cancel).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Back to messages', exact: true })).toBeVisible();
});

for (const profile of [
  { name: 'compact320', width: 320, height: 740, query: '' },
  { name: 'phone200', width: 390, height: 844, query: '?text=200&timer' },
  { name: 'tablet200', width: 834, height: 1112, query: '?text=200&timer' },
  { name: 'short390', width: 390, height: 480, query: '?timer' },
  { name: 'expanded1280', width: 1280, height: 900, query: '?timer' },
]) {
  test(`Visual ${profile.name}: inbox, thread and GIF task keep content and actions reachable`, async ({ page }, info) => {
    await inbox(page, profile.query, { width: profile.width, height: profile.height });
    const capture = async (stage: string) => {
      const geometry = await page.evaluate(() => {
        const box = (selector: string) => {
          const node = document.querySelector(selector);
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop };
        };
        return { viewport: { width: innerWidth, height: innerHeight, visualHeight: visualViewport?.height },
          rootText: getComputedStyle(document.documentElement).fontSize,
          layout: document.querySelector('[data-messages-layout]')?.getAttribute('data-messages-layout'),
          history: box('[aria-label="Message history"]'), composer: box('textarea[placeholder="Message"]'),
          send: box('button[aria-label="Send message"]'), dialog: box('[role="dialog"]'),
          documentWidth: document.documentElement.scrollWidth };
      });
      await info.attach(`${profile.name}-${stage}-geometry`, { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
      await page.screenshot({ path: info.outputPath(`${profile.name}-${stage}.png`), fullPage: true });
    };
    const fonts = await page.evaluate(async () => {
      await Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(font => document.fonts.load(`16px "${font}"`)));
      await document.fonts.ready;
      return ['Inter', 'Merriweather', 'Playfair Display'].map(family => ({ family,
        faces: [...document.fonts].filter(face => face.family.replace(/["']/g, '') === family).map(face => ({ status: face.status, weight: face.weight })) }));
    });
    for (const font of fonts) expect(font.faces.some(face => face.status === 'loaded'), `${font.family} actual loaded face`).toBe(true);
    await info.attach('font-evidence', { body: JSON.stringify(fonts, null, 2), contentType: 'application/json' });
    await usable(page.getByRole('button', { name: 'Open conversation with Taylor Lane', exact: true }));
    await usable(page.getByRole('button', { name: 'Actions for conversation with Taylor Lane', exact: true }));
    await capture('inbox');
    await page.getByRole('button', { name: 'Actions for conversation with Taylor Lane', exact: true }).click();
    const actions = page.getByRole('group', { name: 'Conversation actions for Taylor Lane', exact: true });
    await usable(actions.getByRole('button', { name: 'Mute', exact: true }));
    await usable(actions.getByRole('button', { name: 'Hide conversation', exact: true }));
    await capture('row-actions');
    await page.getByRole('button', { name: 'Actions for conversation with Taylor Lane', exact: true }).click();
    await page.getByRole('button', { name: 'Open conversation with Taylor Lane', exact: true }).click();
    const field = page.getByRole('textbox', { name: 'Message', exact: true });
    await field.fill('A considered response');
    await usable(field);
    await usable(page.getByRole('button', { name: 'Back to messages', exact: true }));
    await usable(page.getByRole('button', { name: 'Send message', exact: true }));
    const history = page.getByRole('region', { name: 'Message history', exact: true });
    expect((await history.boundingBox())!.height).toBeGreaterThan(35);
    const help = page.getByText('Enter sends; Shift+Enter adds a new line.', { exact: true });
    expect((await history.boundingBox())!.y + (await history.boundingBox())!.height, 'History must end before the composer help begins').toBeLessThanOrEqual((await help.boundingBox())!.y + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await capture('thread');
    await page.getByRole('button', { name: 'Search GIFs', exact: true }).click();
    const gif = page.getByRole('dialog', { name: 'Search GIFs', exact: true });
    await gif.getByRole('textbox', { name: 'Search GIFs', exact: true }).fill('reading');
    await gif.getByRole('button', { name: 'Search', exact: true }).click();
    await usable(gif.getByRole('button', { name: 'Send GIF: Reading celebration', exact: true }));
    await capture('gif');
    await usable(gif.getByRole('button', { name: 'Close', exact: true }));
    await page.keyboard.press('Escape');
    await expect(field).toHaveValue('A considered response');
    if (profile.name === 'phone200' || profile.name === 'short390') {
      await reply(page);
      await page.locator('input[type=file]').setInputFiles(attachment);
      await usable(field);
      await usable(page.getByRole('button', { name: 'Cancel reply', exact: true }));
      await usable(page.getByRole('button', { name: 'Remove attached media', exact: true }));
      await usable(page.getByRole('button', { name: 'Send message', exact: true }));
      await capture('reply-file');
    }
  });
}
