import { expect, test, type Locator, type Page } from '@playwright/test';
import type { AdaptiveOverlayFixtureAPI } from '../fixtures/adaptive-overlays/main';

type Snapshot = ReturnType<AdaptiveOverlayFixtureAPI['snapshot']>;
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => window.adaptiveOverlayFixture!.snapshot());
const open = async (page: Page, query = '') => {
  await page.goto(`/${query}`);
  await expect(page.getByTestId('fixture-ready')).toHaveText('Ready', { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.adaptiveOverlayFixture))).toBe(true);
};
const note = (page: Page) => page.getByRole('dialog', { name: 'Reading note', exact: true });
const draft = (page: Page) => page.getByRole('textbox', { name: 'Note draft' });
const pageErrors = new WeakMap<Page, string[]>();

async function coarsePointer(page: Page, coarse: boolean) {
  await page.addInitScript((value) => {
    const original = window.matchMedia.bind(window);
    const overrides = new Map<string, MediaQueryList>();
    const coarseQueries = ['(pointer: coarse)', '(any-pointer: coarse)'];
    const fineQueries = ['(pointer: fine)', '(any-pointer: fine)', '(hover: hover)', '(any-hover: hover)'];
    window.matchMedia = (query) => {
      if (!coarseQueries.includes(query) && !fineQueries.includes(query)) return original(query);
      if (!overrides.has(query)) overrides.set(query, Object.assign(new EventTarget(), {
        media: query, matches: coarseQueries.includes(query) ? value : !value, onchange: null,
      }) as MediaQueryList);
      return overrides.get(query)!;
    };
  }, coarse);
}

async function expectNoHorizontalOverflow(surface: Locator) {
  expect(await surface.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
}

async function expectReadableAction(button: Locator) {
  const contrast = await button.evaluate((element) => {
    const surface = element.closest('.adaptive-dialog')!;
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const foreground = luminance(getComputedStyle(element).color);
    const background = luminance(getComputedStyle(surface).backgroundColor);
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
  });
  expect(contrast, 'Destructive action labels remain readable on their surface').toBeGreaterThanOrEqual(4.5);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => new URL(route.request().url()).origin === 'http://127.0.0.1:8092'
    ? route.continue() : route.abort());
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'No uncaught errors in the real overlay lifecycle').toEqual([]);
});

for (const profile of [
  { name: 'compact-browser', width: 390, height: 844, coarse: false, runtime: 'web', presentation: 'sheet' },
  { name: 'compact-android', width: 390, height: 844, coarse: true, runtime: 'android', presentation: 'sheet' },
  { name: 'tablet-touch', width: 834, height: 1112, coarse: true, runtime: 'ios', presentation: 'sheet' },
  { name: 'tablet-fine', width: 834, height: 900, coarse: false, runtime: 'web', presentation: 'center' },
  { name: 'desktop', width: 1280, height: 900, coarse: false, runtime: 'web', presentation: 'center' },
] as const) {
  test(`${profile.name} adapts real tasks and actions with explicit close and focus return`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await coarsePointer(page, profile.coarse);
    await open(page, `?runtime=${profile.runtime}`);
    const trigger = page.getByRole('button', { name: 'Open reading note' });
    await trigger.click();
    await expect(note(page)).toHaveAttribute('data-presentation', profile.presentation);
    await expect(draft(page)).toBeFocused();
    await expectNoHorizontalOverflow(note(page));
    const bounds = await note(page).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(profile.height + 1);
    if (profile.presentation === 'sheet') expect(Math.abs(bounds!.y + bounds!.height - profile.height)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`${profile.name}-note.png`), animations: 'disabled' });
    await note(page).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(note(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
    const actionsTrigger = page.getByRole('button', { name: 'Open book actions' });
    await actionsTrigger.click();
    const actions = page.getByRole('dialog', { name: 'Book actions' });
    await expect(actions).toHaveAttribute('data-presentation', profile.presentation);
    await expect(actions.getByRole('group', { name: 'Destructive actions' })).toBeVisible();
    await expectReadableAction(actions.getByRole('button', { name: 'Remove from this reading list permanently' }));
    await expectNoHorizontalOverflow(actions);
    await page.screenshot({ path: testInfo.outputPath(`${profile.name}-actions.png`), animations: 'disabled' });
    await actions.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(actions).toHaveCount(0);
    await expect(actionsTrigger).toBeFocused();
    expect((await snapshot(page)).runtime).toBe(profile.runtime);
  });
}

test('uncontrolled draft, node, focus and caret survive phone, split view, desktop and short windows', async ({ page }) => {
  await coarsePointer(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '?runtime=ios');
  await page.getByRole('button', { name: 'Open reading note' }).click();
  const input = draft(page);
  await input.fill('A thought that must survive window changes');
  await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(2, 9));
  const original = await input.elementHandle();
  for (const viewport of [
    { width: 834, height: 1112, presentation: 'sheet' },
    { width: 1280, height: 900, presentation: 'center' },
    { width: 834, height: 320, presentation: 'sheet' },
    { width: 390, height: 844, presentation: 'sheet' },
  ]) {
    await page.setViewportSize(viewport);
    await expect(note(page)).toHaveAttribute('data-presentation', viewport.presentation);
    await expect(input).toHaveValue('A thought that must survive window changes');
    await expect(input).toBeFocused();
    expect(await input.evaluate((element, previous) => element === previous, original)).toBe(true);
    expect(await input.evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd])).toEqual([2, 9]);
    await expectNoHorizontalOverflow(note(page));
  }
  await note(page).getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByLabel('Saved note')).toHaveText('A thought that must survive window changes');
  await expect(page.getByRole('button', { name: 'Open reading note' })).toBeFocused();
});

for (const method of ['Escape', 'Close', 'outside'] as const) {
  test(`${method} requests one guarded dismissal and nested cancellation restores the invoker and draft`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page);
    const trigger = page.getByRole('button', { name: 'Open reading note' });
    await trigger.click();
    const input = draft(page);
    await input.fill('Keep my unfinished note');
    const original = await input.elementHandle();
    const closeButton = note(page).getByRole('button', { name: 'Close', exact: true });
    if (method === 'Escape') await page.keyboard.press('Escape');
    if (method === 'Close') { await closeButton.focus(); await closeButton.click(); }
    if (method === 'outside') await page.mouse.click(8, 8);
    const confirmation = page.getByRole('dialog', { name: 'Discard this note?' });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    expect((await snapshot(page)).closeRequests).toBe(1);
    await confirmation.getByRole('button', { name: 'Keep editing' }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(input).toHaveValue('Keep my unfinished note');
    expect(await input.evaluate((element, previous) => element === previous, original)).toBe(true);
    await expect(method === 'Close' ? closeButton : input).toBeFocused();
    expect((await snapshot(page)).completedCloses).toBe(0);
    const review = note(page).getByRole('button', { name: 'Review discard' });
    await review.focus();
    await review.click();
    await expect(confirmation.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(confirmation).toHaveCount(0);
    await expect(review).toBeFocused();
    await review.click();
    await confirmation.getByRole('button', { name: 'Discard note', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await snapshot(page)).toMatchObject({ confirmed: 1, completedCloses: 1 });
  });
}

test('pending dismissal is consumed and repeated requests leave the same draft mounted', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole('button', { name: 'Open reading note' }).click();
  await draft(page).fill('Pending write stays intact');
  const original = await draft(page).elementHandle();
  await page.getByRole('checkbox', { name: 'Simulate pending save' }).check();
  await draft(page).focus();
  await page.keyboard.press('Escape');
  await note(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(note(page)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Discard this note?' })).toHaveCount(0);
  await expect(draft(page)).toHaveValue('Pending write stays intact');
  expect(await draft(page).evaluate((element, previous) => element === previous, original)).toBe(true);
  expect(await snapshot(page)).toMatchObject({ closeRequests: 2, completedCloses: 0, confirmed: 0 });
});

test('uncontrolled ActionSheet closes after one action and restores its trigger', async ({ page }) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'Open book actions' });
  await trigger.click();
  await page.getByRole('button', { name: 'Move to currently reading', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Selected book action')).toHaveText('reading');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect((await snapshot(page)).selectedAction).toBe('reading');
});

for (const surface of ['note', 'actions'] as const) {
  test(`long ${surface} content at 200% text scrolls within the overlay and keeps its last action reachable`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 720 });
    await coarsePointer(page, true);
    await open(page, '?long&text=200&theme=dark');
    await page.getByRole('button', { name: surface === 'note' ? 'Open reading note' : 'Open book actions' }).click();
    const dialog = page.getByRole('dialog', { name: surface === 'note' ? 'Reading note' : 'Book actions', exact: true });
    await expectNoHorizontalOverflow(dialog);
    expect(await dialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    const finalAction = dialog.getByRole('button', { name: surface === 'note' ? 'Save note' : 'Remove from this reading list permanently', exact: true });
    await finalAction.scrollIntoViewIfNeeded();
    await expect(finalAction).toBeInViewport();
    await finalAction.focus();
    await expect(finalAction).toBeFocused();
    if (surface === 'actions') await expectReadableAction(finalAction);
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(721);
    await expectNoHorizontalOverflow(dialog);
    await page.screenshot({ path: testInfo.outputPath(`${surface}-large-text-final-action.png`), animations: 'disabled' });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    if (surface === 'actions') await expect(page.getByLabel('Selected book action')).toHaveText('remove');
  });
}

test('visual viewport shrink and offset retain the task while pinch uses layout bounds without counterzoom', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 900 });
  await coarsePointer(page, true);
  await page.addInitScript(() => Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: Object.assign(new EventTarget(), { width: 834, height: 900, offsetTop: 0, offsetLeft: 0, scale: 1 }),
  }));
  await open(page, '?runtime=android&long');
  await page.getByRole('button', { name: 'Open reading note' }).click();
  const input = page.getByRole('textbox', { name: 'Last passage note' });
  await input.click();
  await input.fill('Keep editing when the visible viewport changes');
  await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(5, 12));
  await expect(input).toBeInViewport();
  const original = await input.elementHandle();
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { width: 700, height: 380, offsetTop: 30, offsetLeft: 20 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
    window.visualViewport!.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => note(page).evaluate((element: HTMLElement) => element.style.getPropertyValue('--overlay-height'))).toBe('380px');
  await expect.poll(() => note(page).evaluate((element: HTMLElement) => element.style.getPropertyValue('--overlay-top'))).toBe('30px');
  const bounds = await note(page).boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(30);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(411);
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--app-viewport-height'))).toBe('900px');
  expect(await snapshot(page)).toMatchObject({ runtime: 'android', windowClass: 'medium', visualScale: 1 });
  await expect(input).toBeFocused();
  await expect.poll(async () => {
    const field = await input.boundingBox();
    return Boolean(field && field.y >= 30 && field.y + field.height <= 411);
  }).toBe(true);
  expect(await input.evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd])).toEqual([5, 12]);
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { width: 417, height: 300, offsetTop: 90, offsetLeft: 100, scale: 2 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => note(page).evaluate((element: HTMLElement) => element.style.getPropertyValue('--overlay-height'))).toBe('900px');
  expect(await note(page).evaluate((element: HTMLElement) => [
    element.style.getPropertyValue('--overlay-left'), element.style.getPropertyValue('--overlay-top'), element.style.getPropertyValue('--overlay-width'),
  ])).toEqual(['0px', '0px', '834px']);
  expect(await note(page).evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return [matrix.a, matrix.d];
  })).toEqual([1, 1]);
  expect(await input.evaluate((element, previous) => element === previous, original)).toBe(true);
  await expect(input).toHaveValue('Keep editing when the visible viewport changes');
  await expect(input).toBeFocused();
  expect(await input.evaluate((element: HTMLInputElement) => [element.selectionStart, element.selectionEnd])).toEqual([5, 12]);
  expect(await snapshot(page)).toMatchObject({ runtime: 'android', windowClass: 'medium', visualScale: 2 });
});

test('missing optional visual viewport still supports a complete task and explicit dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.addInitScript(() => Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined }));
  await open(page);
  await page.getByRole('button', { name: 'Open reading note' }).click();
  await draft(page).fill('A complete note without the optional API');
  await note(page).getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByLabel('Saved note')).toHaveText('A complete note without the optional API');
  await expect(page.getByRole('button', { name: 'Open reading note' })).toBeFocused();
});

test('real Goals create form and nested calendar retain their drafts through window changes', async ({ page }, testInfo) => {
  await coarsePointer(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const invoker = page.getByRole('button', { name: 'Goals', exact: true });
  await invoker.click();
  await page.getByRole('button', { name: 'Create Goal', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Create New Goal', exact: true });
  await expect(form.getByRole('combobox', { name: 'Goal Type', exact: true })).toBeVisible();
  await expect(form.getByRole('combobox', { name: 'Period', exact: true })).toBeVisible();
  const target = form.getByRole('spinbutton', { name: 'Target', exact: true });
  await target.fill('52');
  const start = form.getByRole('textbox', { name: 'Start Date', exact: true });
  await start.fill('02/');
  await target.click();
  const original = await target.elementHandle();
  for (const viewport of [{ width: 834, height: 1112 }, { width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(target).toHaveValue('52');
    await expect(target).toBeFocused();
    expect(await target.evaluate((element, previous) => element === previous, original)).toBe(true);
    await expect(start).toHaveValue('02/');
    await expect(form.getByRole('button', { name: 'Create Goal', exact: true })).toBeDisabled();
  }
  await form.getByRole('button', { name: 'Choose date: End Date', exact: true }).click();
  const calendar = page.getByRole('dialog', { name: 'Choose date: End Date', exact: true });
  await expect(calendar).toBeVisible();
  await page.setViewportSize({ width: 834, height: 1112 });
  await expect(calendar).toHaveAttribute('data-date-picker-presentation', 'dialog');
  await page.screenshot({ path: testInfo.outputPath('goals-nested-calendar-tablet.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(calendar).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Choose date: End Date', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create Goal', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(invoker).toBeFocused();
});

test('keyboard action focus stays visible in forced colors and live motion changes do not animate the task', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'no-preference' });
  await open(page);
  const trigger = page.getByRole('button', { name: 'Open book actions' });
  await trigger.focus();
  await trigger.press('Enter');
  const surface = page.getByRole('dialog', { name: 'Book actions' });
  const action = surface.getByRole('button', { name: 'Move to currently reading' });
  await expect(action).toBeFocused();
  const outline = await action.evaluate((element) => {
    const style = getComputedStyle(element);
    return { active: matchMedia('(forced-colors: active)').matches, style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth), color: style.outlineColor };
  });
  expect(outline.active).toBe(true);
  expect(outline.style).toBe('solid');
  expect(outline.width).toBeGreaterThanOrEqual(2);
  expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  expect(await surface.evaluate((element) => element.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(action).toBeFocused();
  expect(await surface.evaluate((element) => element.getAnimations().length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(surface).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
