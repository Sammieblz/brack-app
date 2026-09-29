import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Operation } from '../fixtures/live-composers/state';
import type { LiveComposersAPI } from '../fixtures/live-composers/main';

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
  const requests = await page.evaluate(() => window.liveComposers?.snapshot() ?? null).catch(() => null);
  await testInfo.attach('request-evidence', { body: JSON.stringify(requests, null, 2), contentType: 'application/json' });
  expect(log.errors, 'No uncaught renderer errors').toEqual([]);
  expect(log.warnings.filter((warning) => /DialogContent.*(DialogTitle|Description)|Missing.*Description/i.test(warning)), 'Named target dialogs').toEqual([]);
});

async function ready(page: Page, path: string, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
}
async function configure(page: Page, operation: Operation, mode: 'resolve' | 'reject' | 'defer') {
  await page.evaluate(({ operation, mode }) => window.liveComposers!.configure(operation, mode), { operation, mode });
}
async function settle(page: Page, operation: Operation, outcome: 'resolve' | 'reject') {
  await expect.poll(() => page.evaluate((operation) => window.liveComposers!.snapshot().pending.includes(operation), operation)).toBe(true);
  await page.evaluate(({ operation, outcome }) => window.liveComposers!.settle(operation, outcome), { operation, outcome });
}
async function calls(page: Page, operation: Operation) {
  return page.evaluate((operation) => window.liveComposers!.snapshot().calls.filter((entry) => entry.operation === operation), operation);
}
async function expectCalls(page: Page, operation: Operation, count: number) {
  await expect.poll(async () => (await calls(page, operation)).length).toBe(count);
}
async function composeIME(field: Locator) {
  await field.dispatchEvent('compositionstart');
  await field.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true });
  await field.dispatchEvent('compositionend');
}
async function openComments(page: Page, route: string, viewport?: { width: number; height: number }) {
  await ready(page, route, viewport);
  const trigger = page.getByRole('button', { name: 'Comments, 1', exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const field = page.getByRole('textbox', { name: 'Comment', exact: true });
  await expect(field).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scroll to top', exact: true, includeHidden: true })).toBeHidden();
  await expect(page.getByText('The quiet details stayed with me.', { exact: true })).toBeVisible();
  return { field, trigger };
}

const commentRoutes = [
  ['Feed', '/feed'],
  ['PostDetail', '/posts/post-reading'],
  ['UserProfile', '/users/reader-taylor?tab=posts'],
] as const;

for (const [screen, route] of commentRoutes) {
  test(`${screen}: live comment keeps a newer draft through pending submission and local collapse`, async ({ page }) => {
    const { field, trigger } = await openComments(page, route);
    await expect(field).toHaveAccessibleDescription('Enter adds a new line. Use the Comment button to post.');
    await field.fill('A reading thought');
    await field.press('Enter');
    await field.press('a');
    await expect(field).toHaveValue('A reading thought\na');
    await composeIME(field);
    await expectCalls(page, 'comment', 0);
    await configure(page, 'comment', 'defer');
    const submit = page.getByRole('button', { name: 'Comment', exact: true });
    await submit.focus();
    await submit.press('Enter');
    await expectCalls(page, 'comment', 1);
    await expect(page.getByRole('button', { name: 'Posting...', exact: true })).toBeDisabled();
    await field.fill('A newer thought');
    await trigger.click();
    await expect(field).toBeHidden();
    await settle(page, 'comment', 'resolve');
    await trigger.click();
    await expect(field).toHaveValue('A newer thought');
    await expect(submit).toBeEnabled();
    await expectCalls(page, 'comment', 1);
    expect((await calls(page, 'comment'))[0].payload).toMatchObject({ content: 'A reading thought\na', parentId: null });
  });

  test(`${screen}: failed comments and replies keep named errors, retry and newer reply text`, async ({ page }) => {
    const { field } = await openComments(page, route);
    await configure(page, 'comment', 'reject');
    await field.fill('Keep this comment');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(field).toHaveAccessibleDescription(/Comment could not be posted\. Your draft is still here\. Try again\./);
    await expect(field).toHaveValue('Keep this comment');
    await configure(page, 'comment', 'resolve');
    await page.getByRole('button', { name: 'Comment', exact: true }).press('Space');
    await expect(field).toHaveValue('');
    await expectCalls(page, 'comment', 2);
    const replyTrigger = page.getByRole('button', { name: 'Reply', exact: true }).first();
    await replyTrigger.click();
    const reply = page.getByRole('textbox', { name: 'Reply to Taylor Lane', exact: true });
    const composer = reply.locator('..');
    await expect(reply).toHaveAccessibleDescription('Enter adds a new line. Use the Reply button to post.');
    await reply.fill('Keep this reply');
    await configure(page, 'comment', 'reject');
    await composer.getByRole('button', { name: 'Reply', exact: true }).click();
    await expect(reply).toHaveAccessibleDescription(/Reply could not be posted/);
    await configure(page, 'comment', 'defer');
    await composer.getByRole('button', { name: 'Reply', exact: true }).press('Enter');
    await expectCalls(page, 'comment', 4);
    await expect(composer.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
    await expect(replyTrigger).toBeDisabled();
    await reply.fill('The next reply');
    await settle(page, 'comment', 'resolve');
    await expect(reply).toHaveValue('The next reply');
    expect((await calls(page, 'comment'))[3].payload).toMatchObject({ content: 'Keep this reply', parentId: 'comment-one' });
    await configure(page, 'comment', 'resolve');
    await composer.getByRole('button', { name: 'Reply', exact: true }).press('Enter');
    await expect(reply).toBeHidden();
    await expect(replyTrigger).toBeFocused();
    await expectCalls(page, 'comment', 5);
  });
}

for (const [screen, route, otherTab] of [
  ['Feed', '/feed', 'Activity'],
  ['UserProfile', '/users/reader-taylor?tab=posts', 'Books'],
] as const) {
  test(`${screen}: actual parent tabs retain the comment owner, pending outcome and newer draft`, async ({ page }) => {
    const { field } = await openComments(page, route);
    const originalNode = await field.elementHandle();
    const submit = page.getByRole('button', { name: 'Comment', exact: true });
    await field.fill('First pending comment');
    await configure(page, 'comment', 'defer');
    await submit.click();
    await expectCalls(page, 'comment', 1);
    await field.fill('Draft written during the failed send');
    await page.getByRole('tab', { name: otherTab, exact: true }).click();
    await expect(field).toBeHidden();
    await settle(page, 'comment', 'reject');
    await page.getByRole('tab', { name: 'Posts', exact: true }).click();
    await expect(field).toHaveValue('Draft written during the failed send');
    await expect(field).toHaveAccessibleDescription(/Comment could not be posted/);
    expect(await field.evaluate((node, previous) => node === previous, originalNode)).toBe(true);
    await submit.click();
    await expectCalls(page, 'comment', 2);
    await field.fill('Draft written during the successful send');
    await page.getByRole('tab', { name: otherTab, exact: true }).click();
    await settle(page, 'comment', 'resolve');
    await page.getByRole('tab', { name: 'Posts', exact: true }).click();
    await expect(field).toHaveValue('Draft written during the successful send');
    await expect(submit).toBeEnabled();
    expect(await field.evaluate((node, previous) => node === previous, originalNode)).toBe(true);
    await expectCalls(page, 'comment', 2);
  });
}

const chatCases = [
  { kind: 'direct', route: '/messages', field: 'Message', send: 'Send message', upload: 'direct-upload', operation: 'direct-send',
    remove: 'Remove attached media', media: 'Open message image', title: 'Message media', description: 'Full-size media from this conversation.' },
  { kind: 'club', route: '/clubs/club-one', field: 'Message the club', send: 'Send club message', upload: 'club-upload', operation: 'club-send',
    remove: 'Remove attachments', media: 'Open club chat media', title: 'Club chat media', description: 'Image or GIF shared in this club conversation.' },
] as const;
type Chat = typeof chatCases[number];
async function openChat(page: Page, chat: Chat, query = '', viewport?: { width: number; height: number }) {
  await ready(page, `${chat.route}${query}`, viewport);
  if (chat.kind === 'direct') {
    // Select the real ConversationsList row through its last-message text.
    await page.getByText('Have you reached the next chapter?', { exact: true }).click();
  } else {
    await page.getByRole('tab', { name: 'Chat', exact: true }).click();
  }
  const field = page.getByRole('textbox', { name: chat.field, exact: true });
  await expect(field).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scroll to top', exact: true, includeHidden: true })).toBeHidden();
  return field;
}
const attachment = { name: 'reading.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') };

for (const chat of chatCases) {
  test(`${chat.kind}: real chat supports multiline/IME, serializes Enter and preserves newer typing`, async ({ page }) => {
    const field = await openChat(page, chat);
    await expect(field).toHaveAccessibleDescription(/Enter sends; Shift\+Enter adds a new line/);
    await field.fill('First line');
    await field.press('Shift+Enter');
    await field.press('a');
    await expect(field).toHaveValue('First line\na');
    await composeIME(field);
    await expectCalls(page, chat.operation, 0);
    await configure(page, chat.operation, 'defer');
    await field.press('Enter');
    await expectCalls(page, chat.operation, 1);
    await expect(page.getByRole('button', { name: chat.send, exact: true })).toBeDisabled();
    await field.fill('The next message');
    await field.press('Enter');
    await expectCalls(page, chat.operation, 1);
    await settle(page, chat.operation, 'resolve');
    await expect(field).toHaveValue('The next message');
    await expect(page.getByRole('button', { name: chat.send, exact: true })).toBeEnabled();
    expect((await calls(page, chat.operation))[0].payload).toMatchObject({ content: 'First line\na' });
  });

  test(`${chat.kind}: upload and send failures retain attachments and retry one logical request`, async ({ page }) => {
    const field = await openChat(page, chat);
    await field.fill('This passage');
    await page.locator('input[type=file]').setInputFiles(attachment);
    await configure(page, chat.upload, 'defer');
    await configure(page, chat.operation, 'defer');
    const send = page.getByRole('button', { name: chat.send, exact: true });
    const remove = page.getByRole('button', { name: chat.remove, exact: true });
    await send.click();
    await expect(remove).toBeDisabled();
    await field.press('Enter');
    await expectCalls(page, chat.upload, 1);
    await expectCalls(page, chat.operation, 0);
    await settle(page, chat.upload, 'reject');
    await expect(page.getByRole('alert').filter({ hasText: `Fixture ${chat.upload} failed` }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Attach image or GIF', exact: true })).toHaveAccessibleDescription(`Fixture ${chat.upload} failed`);
    await expect(field).toHaveValue('This passage');
    await expect(remove).toBeEnabled();
    await configure(page, chat.upload, 'resolve');
    await send.click();
    await expectCalls(page, chat.operation, 1);
    await settle(page, chat.operation, 'reject');
    await expect(field).toHaveAccessibleDescription(chat.kind === 'direct' ? /Message wasn't sent/ : /Fixture club-send failed/);
    await expect(field).toHaveValue('This passage');
    await expect(remove).toBeEnabled();
    await configure(page, chat.operation, 'resolve');
    await send.click();
    await expect(field).toHaveValue('');
    await expect(remove).toBeHidden();
    await expectCalls(page, chat.upload, 2);
    await expectCalls(page, chat.operation, 2);
    const attempts = await calls(page, chat.operation);
    expect(attempts[0].payload).toEqual(attempts[1].payload);
    expect(attempts[1].payload).toMatchObject({ content: 'This passage', client_message_id: expect.any(String), media: [expect.objectContaining({ storage_path: 'reading.png' })] });
  });

  test(`${chat.kind}: named media closes by Escape, app Back and close control with exact focus return`, async ({ page }) => {
    await openChat(page, chat, '?runtime=android');
    await expect.poll(() => page.evaluate(() => window.liveComposers!.native().active)).toBe(1);
    // Prior dialogs/popovers must not steal the later media overlay's Back owner.
    const gif = page.getByRole('button', { name: 'Search GIFs', exact: true });
    await gif.click();
    await expect(page.getByRole('dialog', { name: 'Search GIFs', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(gif).toBeFocused();
    const emoji = page.getByRole('button', { name: 'Add emoji', exact: true });
    await emoji.click();
    await expect(emoji).toHaveAttribute('aria-expanded', 'true');
    const emojiSearch = page.getByRole('textbox', { name: 'Type to search for an emoji', exact: true });
    await expect(emojiSearch).toBeVisible();
    await expect(emojiSearch).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(emoji).toHaveAttribute('aria-expanded', 'false');
    await expect(emojiSearch).toBeHidden();
    await expect(emoji).toBeFocused();
    const opener = page.getByRole('button', { name: chat.media, exact: true }).first();
    for (const close of ['escape', 'back', 'button']) {
      await opener.focus();
      await opener.press('Enter');
      const dialog = page.getByRole('dialog', { name: chat.title, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleDescription(chat.description);
      if (close === 'escape') await page.keyboard.press('Escape');
      else if (close === 'back') await page.evaluate(() => window.liveComposers!.back());
      else await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    }
    expect(await page.evaluate(() => window.liveComposers!.native().minimized)).toBe(0);
  });

  test(`${chat.kind}: failed media remains named, dismissible and restores its invoker`, async ({ page }) => {
    await openChat(page, chat, '?brokenMedia');
    const opener = page.getByRole('button', { name: chat.media, exact: true }).first();
    await opener.click();
    const dialog = page.getByRole('dialog', { name: chat.title, exact: true });
    await expect(dialog.getByRole('alert')).toContainText('could not load');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test(`${chat.kind}: GIF search/send errors are local and pending sends cannot dismiss or duplicate`, async ({ page }) => {
    await openChat(page, chat);
    const trigger = page.getByRole('button', { name: 'Search GIFs', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Search GIFs', exact: true });
    const search = dialog.getByRole('textbox', { name: 'Search GIFs', exact: true });
    await search.fill('reading');
    await composeIME(search);
    await expectCalls(page, 'gif', 0);
    await configure(page, 'gif', 'reject');
    await search.press('Enter');
    await expect(dialog.getByRole('alert')).toContainText('Fixture gif failed');
    await expect(search).toHaveValue('reading');
    await configure(page, 'gif', 'resolve');
    await dialog.getByRole('button', { name: 'Search', exact: true }).click();
    const result = dialog.getByRole('button', { name: /Reading celebration/ });
    await expect(result).toBeVisible();
    await configure(page, chat.operation, 'defer');
    await result.click();
    await expectCalls(page, chat.operation, 1);
    await expect(result).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await settle(page, chat.operation, 'reject');
    await expect(dialog.getByRole('alert')).toBeVisible();
    await configure(page, chat.operation, 'resolve');
    await expect(result).toBeVisible();
    await expect(result).toBeEnabled();
    await result.click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expectCalls(page, chat.operation, 2);
    const attempts = await calls(page, chat.operation);
    expect(attempts[0].payload).toEqual(attempts[1].payload);
  });
}

test('club: actual Chat and Overview tabs retain pending failure, retry and newer draft', async ({ page }) => {
  const chat = chatCases[1];
  const field = await openChat(page, chat, '', { width: 390, height: 640 });
  const originalNode = await field.elementHandle();
  const send = page.getByRole('button', { name: chat.send, exact: true });
  await field.fill('First pending club message');
  await configure(page, 'club-send', 'defer');
  await send.click();
  await expectCalls(page, 'club-send', 1);
  await field.fill('Draft written during the failed send');
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(field).toBeHidden();
  const scrollOwner = page.locator('[data-app-scroll-container]');
  await scrollOwner.evaluate((owner) => { owner.scrollTop = owner.scrollHeight; });
  await expect.poll(() => scrollOwner.evaluate((owner) => owner.scrollTop)).toBeGreaterThan(320);
  await expect(page.getByRole('button', { name: 'Scroll to top', exact: true })).toBeVisible();
  await settle(page, 'club-send', 'reject');
  await page.getByRole('tab', { name: 'Chat', exact: true }).click();
  await expect(field).toHaveValue('Draft written during the failed send');
  await expect(page.getByRole('button', { name: 'Scroll to top', exact: true, includeHidden: true })).toBeHidden();
  await expect(field).toHaveAccessibleDescription(/Fixture club-send failed/);
  expect(await field.evaluate((node, previous) => node === previous, originalNode)).toBe(true);
  await send.click();
  await expectCalls(page, 'club-send', 2);
  await field.fill('Draft written during the successful send');
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await settle(page, 'club-send', 'resolve');
  await page.getByRole('tab', { name: 'Chat', exact: true }).click();
  await expect(field).toHaveValue('Draft written during the successful send');
  await expect(send).toBeEnabled();
  expect(await field.evaluate((node, previous) => node === previous, originalNode)).toBe(true);
  await expectCalls(page, 'club-send', 2);
});

for (const [screen, route] of [
  ['PostDetail', '/posts/post-reading?text=200'],
  ['UserProfile', '/users/reader-taylor?tab=posts&text=200'],
] as const) {
  test(`${screen}: keyboard return clears the sticky header and preserves draft and native caret behavior`, async ({ page }) => {
    const { field } = await openComments(page, route);
    const draft = 'A reading thought to keep.';
    await field.fill(draft);
    // Compare against this engine's visible native return behavior: WebKit resets
    // the caret on keyboard re-entry even without a shell or scroll adjustment.
    await field.press('End');
    await field.press('ArrowLeft');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Comment', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(field).toBeFocused();
    await expectUnobscuredControl(field);
    await expect(field).toHaveValue(draft);
    const nativeReturnCaret = await field.evaluate((element: HTMLTextAreaElement) => ({ start: element.selectionStart, end: element.selectionEnd }));
    await field.press('End');
    await field.press('ArrowLeft');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Comment', exact: true })).toBeFocused();
    // Reproduce a reader scrolling the still-open task while its action has focus.
    // The precondition is geometric, independent of the shell's implementation.
    const scroll = await field.evaluate((element) => {
      const owner = element.closest('[data-app-scroll-container]')!;
      const bounds = owner.getBoundingClientRect();
      const header = owner.querySelector('header')!.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return { x: bounds.left + 5, y: bounds.bottom - 40, delta: box.top - (header.bottom - box.height / 2) };
    });
    await page.mouse.move(scroll.x, scroll.y);
    await page.mouse.wheel(0, scroll.delta);
    await expect.poll(() => field.evaluate((element) => {
      const header = element.closest('[data-app-scroll-container]')!.querySelector('header')!.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return box.top < header.bottom && box.bottom > header.bottom;
    })).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(field).toBeFocused();
    await expectUnobscuredControl(field);
    await expect(field).toHaveValue(draft);
    expect(await field.evaluate((element: HTMLTextAreaElement) => ({ start: element.selectionStart, end: element.selectionEnd }))).toEqual(nativeReturnCaret);
    await expectCalls(page, 'comment', 0);
  });
}

for (const [name, viewport, query] of [
  ['narrow', { width: 320, height: 844 }, ''],
  ['compact', { width: 390, height: 844 }, ''],
  ['tablet', { width: 834, height: 1112 }, ''],
  ['large-text', { width: 390, height: 844 }, 'text=200'],
] as const) {
  test(`real caller screenshots: ${name}`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    const fontEvidence: unknown[] = [];
    for (const [screen, route] of commentRoutes) {
      const suffix = query ? `${route.includes('?') ? '&' : '?'}${query}` : '';
      const { field } = await openComments(page, `${route}${suffix}`, viewport);
      await field.fill('A thought worth sharing with this reading community.');
      const send = page.getByRole('button', { name: 'Comment', exact: true });
      await expectComposerGeometry(page, field, [send]);
      fontEvidence.push(await fonts(page, screen));
      await testInfo.attach(`${name}-${screen}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
    for (const chat of chatCases) {
      const field = await openChat(page, chat, query ? `?${query}` : '', viewport);
      await field.fill('A thought worth sharing with this reading community.');
      const send = page.getByRole('button', { name: chat.send, exact: true });
      await expectComposerGeometry(page, field, [
        page.getByRole('button', { name: 'Attach image or GIF', exact: true }),
        page.getByRole('button', { name: 'Search GIFs', exact: true }),
        page.getByRole('button', { name: 'Add emoji', exact: true }),
        send,
      ]);
      fontEvidence.push(await fonts(page, chat.kind));
      await testInfo.attach(`${name}-${chat.kind}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
    await testInfo.attach('font-evidence', { body: JSON.stringify(fontEvidence, null, 2), contentType: 'application/json' });
  });
}

async function expectComposerGeometry(page: Page, field: Locator, actions: Locator[]) {
  await page.evaluate(() => document.fonts.ready);
  await scrollWithPagePadding(field);
  await expect(field).toBeInViewport({ ratio: 1 });
  await expectUnobscuredControl(field);
  const width = await field.evaluate((element) => ({
    actual: element.getBoundingClientRect().width,
    minimum: Math.min(180, element.parentElement!.getBoundingClientRect().width),
  }));
  expect(width.actual, 'The composer must have usable writing width').toBeGreaterThanOrEqual(width.minimum - 1);
  for (const action of actions) {
    await scrollWithPagePadding(action);
    await expect(action).toBeInViewport({ ratio: 1 });
    await expectUnobscuredControl(action);
  }
  const viewport = page.viewportSize()!;
  const controls = [field, ...actions];
  const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
  for (let index = 0; index < boxes.length; index++) {
    await expectUnobscuredControl(controls[index]);
    const box = boxes[index]!;
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.y).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
    for (const other of boxes.slice(index + 1)) {
      const overlapWidth = Math.min(box.x + box.width, other!.x + other!.width) - Math.max(box.x, other!.x);
      const overlapHeight = Math.min(box.y + box.height, other!.y + other!.height) - Math.max(box.y, other!.y);
      expect(overlapWidth > 0.5 && overlapHeight > 0.5, 'Composer text and actions must not overlap').toBe(false);
    }
  }
}

async function scrollWithPagePadding(control: Locator) {
  // Native scrolling honors the production scroller's measured sticky-header
  // scroll-padding; Playwright's protocol centering can frame another field underneath it.
  await control.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }));
}

async function expectUnobscuredControl(control: Locator) {
  await expect.poll(() => control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const owner = element.closest('[data-app-scroll-container]');
    const header = owner?.querySelector('header');
    const headerBottom = header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0;
    const hits = [0.15, 0.5, 0.85].map((fraction) => {
      const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height * fraction);
      return target === element || element.contains(target);
    });
    return { clearsHeader: box.top >= headerBottom - 0.5, hits };
  }), { message: 'Text and controls must clear the sticky header and receive input throughout their height' })
    .toEqual({ clearsHeader: true, hits: [true, true, true] });
}

async function fonts(page: Page, screen: string) {
  return page.evaluate(async (screen) => {
    await document.fonts.ready;
    const faces = Array.from(document.fonts).map((face) => ({ family: face.family, status: face.status }));
    return { screen, faces, inter: document.fonts.check('16px Inter'), merriweather: document.fonts.check('16px Merriweather'),
      playfair: document.fonts.check('16px "Playfair Display"'), declaredFamily: getComputedStyle(document.body).fontFamily };
  }, screen);
}

// Keep the browser control type reachable to tsc without pulling fixture code into the test runner.
type FixtureAPI = LiveComposersAPI;
export type { FixtureAPI };
