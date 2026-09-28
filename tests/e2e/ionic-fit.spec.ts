import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { ReadingDraft, SavedReadingDraft } from '../fixtures/ionic-fit/reading-form';

declare global {
  interface Window { modalPlaybackDurations: number[] }
}

type FitSnapshot = { open: boolean; pending: boolean; saves: SavedReadingDraft[]; draft: ReadingDraft; presents: number; dismisses: string[] };
const errors = new WeakMap<BrowserContext, string[]>();
test.beforeEach(async ({ page, context }) => {
  errors.set(context, []);
  context.on('page', (other) => other.on('pageerror', (error) => errors.get(context)?.push(error.message)));
  page.on('pageerror', (error) => errors.get(context)?.push(error.message));
  await context.route('**/*', (route) => new URL(route.request().url()).origin === 'http://127.0.0.1:8090' ? route.continue() : route.abort());
});
test.afterEach(async ({ context }) => { expect(errors.get(context), 'No uncaught renderer errors').toEqual([]); });

async function load(page: Page, params = '', baseline = false) {
  await page.goto(`${baseline ? '/baseline.html' : '/'}${params ? `?${params}` : ''}`);
  await expect(page.getByRole('heading', { name: 'Your next chapter', exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => Boolean(window.ionicFitFixture));
}
const snapshot = (page: Page): Promise<FitSnapshot> => page.evaluate(() => window.ionicFitFixture.snapshot());
async function open(page: Page) {
  await page.getByRole('button', { name: 'Add reading note', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reading note', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#reading-title')).toBeFocused();
  return dialog;
}
const dateField = (page: Page) => page.getByRole('textbox', { name: /^Reading date \(/ });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save reading note', exact: true });
const day = (root: Locator, year: number, month: number, date: number) => root.getByRole('gridcell', {
  name: new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(year, month - 1, date)), exact: true,
});

for (const baseline of [true]) {
  test(`${baseline ? 'Radix baseline' : 'Ionic candidate'}: named modal, single focus owner, clean close and focus return`, async ({ page }, info) => {
    await load(page, 'runtime=native&mode=ios', baseline);
    const dialog = await open(page);
    if (info.project.name === 'chromium') await page.screenshot({ path: info.outputPath('radix-baseline-phone.png') });
    await expect(page.getByRole('dialog')).toHaveCount(1);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const active = document.activeElement;
        return { inside: !!active && !!active.closest('.fit-form, ion-modal, [role="dialog"]'), element: active?.outerHTML.slice(0, 160) };
      });
      expect(focus.inside, `Tab ${i + 1}: ${focus.element}`).toBe(true);
    }
    await page.getByRole('button', { name: 'Close reading note', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add reading note', exact: true })).toBeFocused();
    expect((await snapshot(page)).saves).toHaveLength(0);
  });
}

test('Ionic candidate: clean close restores the opener and background access', async ({ page }) => {
  await load(page, 'runtime=native&mode=ios'); const dialog = await open(page);
  await expect(page.getByTestId('experience-background')).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('button', { name: 'Close reading note', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add reading note', exact: true })).toBeFocused();
  await expect(page.getByTestId('experience-background')).not.toHaveAttribute('aria-hidden', 'true');
});

test('ADOPTION GATE: Ionic modal cycles Tab within the reading task', async ({ page }, info) => {
  await load(page, 'runtime=native&mode=ios'); await open(page);
  const observations = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => new Promise<{ inside: boolean; documentHasFocus: boolean; element: string | undefined }>((resolve) => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        resolve({ inside: !!active && !!active.closest('.fit-form, ion-modal, [role="dialog"]'), documentHasFocus: document.hasFocus(), element: active?.outerHTML.slice(0, 200) });
      });
    }));
    observations.push({ tab: i + 1, ...focus });
    if (!focus.inside) break;
  }
  const evidencePath = info.outputPath('modal-focus-boundary.json');
  await writeFile(evidencePath, JSON.stringify(observations, null, 2));
  await info.attach('modal-focus-boundary', { path: evidencePath, contentType: 'application/json' });
  test.fail(info.project.name !== 'firefox', 'Ionic9.0.5 lets Tab leave the document in Chromium/WebKit after the last modal control; Firefox cycles correctly. Modal adoption remains blocked.');
  expect(observations.every((item) => item.inside), 'Every Tab remains inside the modal, including the final-to-first boundary').toBe(true);
});

test('pending, failed and retried saves retain draft and commit once without a decorative wait', async ({ page }) => {
  await load(page, 'runtime=native&mode=md'); await open(page);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A note worth keeping');
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('The quiet detail in chapter four.');
  await dateField(page).fill('02/29/2000');
  await saveButton(page).dblclick({ delay: 10 });
  await expect.poll(async () => (await snapshot(page)).pending).toBe(true);
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.ionicFitFixture.dismiss('gesture'))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => window.ionicFitFixture.rejectSave());
  await expect(page.getByRole('alert')).toHaveText('Could not save this fixture note. Try again.');
  await expect(dateField(page)).toHaveValue('02/29/2000');
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('The quiet detail in chapter four.');
  await saveButton(page).click();
  await page.evaluate(() => window.ionicFitFixture.resolveSave());
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).saves).toEqual([{ title: 'A note worth keeping', date: '2000-02-29', notes: 'The quiet detail in chapter four.' }]);
  await expect(page.getByTestId('save-announcement')).toHaveText('Note saved in this local demonstration.');
});

test('dirty Escape, backdrop and gesture dismissal share one explicit discard decision', async ({ page }) => {
  await load(page, 'runtime=native&mode=ios'); await open(page);
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Keep this draft');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Discard this reading note?', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.locator('ion-modal ion-backdrop').click({ position: { x: 8, y: 8 }, force: true });
  await expect(page.getByRole('heading', { name: 'Discard this reading note?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await page.evaluate(() => window.ionicFitFixture.dismiss('gesture'))).toBe(false);
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('Keep this draft');
  await page.getByRole('button', { name: 'Discard note', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await open(page);
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('');
  expect((await snapshot(page)).saves).toHaveLength(0);
});

test('inline historical calendar keeps one overlay and commits only day selection', async ({ page }) => {
  await load(page); await open(page);
  await dateField(page).fill('06/10/2026');
  await page.getByRole('button', { name: 'Choose reading date', exact: true }).click();
  const calendar = page.getByRole('region', { name: 'Reading date calendar', exact: true });
  await calendar.getByRole('button', { name: 'Choose year', exact: true }).click();
  for (let decade = 0; decade < 3; decade++) await calendar.getByRole('button', { name: 'Previous decade', exact: true }).click();
  await calendar.getByRole('button', { name: '1999', exact: true }).click();
  await expect(dateField(page)).toHaveValue('06/10/2026');
  await calendar.getByRole('button', { name: 'Choose month', exact: true }).click();
  await calendar.getByRole('button', { name: 'February', exact: true }).click();
  await day(calendar, 1999, 2, 5).click();
  await expect(dateField(page)).toHaveValue('02/05/1999');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Choose reading date', exact: true })).toBeFocused();
  await saveButton(page).click(); await page.evaluate(() => window.ionicFitFixture.resolveSave());
  await expect.poll(async () => (await snapshot(page)).saves[0]?.date).toBe('1999-02-05');
});

test('calendar arrow and Escape stay within inline date task', async ({ page }) => {
  await load(page); await open(page);
  await page.getByRole('button', { name: 'Choose reading date', exact: true }).click();
  const calendar = page.getByRole('region', { name: 'Reading date calendar', exact: true });
  await expect(day(calendar, 1999, 2, 5)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(day(calendar, 1999, 2, 6)).toBeFocused();
  await expect(dateField(page)).toHaveValue('02/05/1999');
  await page.keyboard.press('Escape');
  await expect(calendar).toBeHidden();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose reading date', exact: true })).toBeFocused();
});

for (const [locale, text] of [['en-US', '02/05/1999'], ['en-GB', '05/02/1999'], ['fr-FR', '05/02/1999']]) {
  test(`locale ${locale}: typed civil date is preserved without timezone conversion`, async ({ page }) => {
    await load(page, `locale=${locale}`); await open(page);
    await dateField(page).fill(text); await saveButton(page).click();
    await page.evaluate(() => window.ionicFitFixture.resolveSave());
    await expect.poll(async () => (await snapshot(page)).saves[0]?.date).toBe('1999-02-05');
  });
}

test('invalid, required and out-of-bounds dates cannot save and remain editable', async ({ page }) => {
  await load(page, 'required=1&min=1900-01-01&max=2000-12-31'); await open(page);
  for (const text of ['02/29/1900', '02/', '', '01/01/1899', '01/01/2001']) {
    await dateField(page).fill(text); await dateField(page).blur();
    await expect(saveButton(page)).toBeDisabled();
    await expect(dateField(page)).toHaveValue(text);
    await expect(dateField(page)).toHaveAttribute('aria-invalid', 'true');
  }
  await dateField(page).fill('02/29/2000');
  await expect(saveButton(page)).toBeEnabled();
  expect((await snapshot(page)).saves).toHaveLength(0);
});

test('optional clearing commits null, never an invented instant', async ({ page }) => {
  await load(page); await open(page);
  await page.getByRole('button', { name: 'Clear reading date', exact: true }).click();
  await expect(dateField(page)).toHaveValue(''); await saveButton(page).click();
  await page.evaluate(() => window.ionicFitFixture.resolveSave());
  await expect.poll(async () => (await snapshot(page)).saves).toHaveLength(1);
  expect((await snapshot(page)).saves[0].date).toBeNull();
});

for (const [width, height, text] of [[320, 568, 100], [390, 844, 200], [834, 1112, 200], [1280, 800, 100]]) {
  test(`reflow at ${width}x${height} and ${text}% text retains a reachable save`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await load(page, `runtime=native&mode=ios&text=${text}`); await open(page);
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Draft survives the available space.');
    await saveButton(page).scrollIntoViewIfNeeded();
    const box = await saveButton(page).boundingBox();
    expect(box).not.toBeNull(); expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    const overflow = await page.getByTestId('reading-scroll').evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    if (info.project.name === 'chromium') await page.screenshot({ path: info.outputPath(`reading-form-${width}-${text}.png`), fullPage: false });
    await saveButton(page).click(); await page.evaluate(() => window.ionicFitFixture.resolveSave());
    await expect(page.getByRole('dialog')).toBeHidden();
  });
}

test('resizing an open sheet and a short viewport preserve draft and single scroll ownership', async ({ page }) => {
  await load(page, 'runtime=native&mode=ios');
  await page.evaluate(() => window.scrollTo(0, 200));
  await open(page);
  const frozenScroll = await page.evaluate(() => window.scrollY);
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Unchanged after rotation.');
  for (const size of [{ width: 834, height: 1112 }, { width: 390, height: 360 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('Unchanged after rotation.');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await saveButton(page).scrollIntoViewIfNeeded();
    const box = await saveButton(page).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);
    expect(await page.evaluate(() => window.scrollY)).toBe(frozenScroll);
  }
  await page.getByRole('button', { name: 'Close reading note', exact: true }).click();
  await page.getByRole('button', { name: 'Discard note', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

for (const [palette, theme] of [['default', 'light'], ['paper-library', 'light'], ['high-contrast', 'dark'], ['amoled-black', 'dark']]) {
  test(`theme bridge ${palette}/${theme} keeps BRACK tokens and font roles`, async ({ page }, info) => {
    await load(page, `palette=${palette}&theme=${theme}&runtime=native&mode=md`); await open(page);
    const values = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const modal = document.querySelector('ion-modal')!;
      const wrapper = modal.shadowRoot!.querySelector('[part="content"]')!;
      const colorProbe = document.createElement('span'); colorProbe.style.backgroundColor = 'hsl(var(--background))'; document.body.append(colorProbe);
      const expected = getComputedStyle(colorProbe).backgroundColor; colorProbe.remove();
      return { expected, actual: getComputedStyle(wrapper).backgroundColor,
        font: getComputedStyle(modal).fontFamily, primary: root.getPropertyValue('--ion-color-primary').trim(), expectedPrimary: `hsl(${root.getPropertyValue('--primary').trim()})`,
        headingFont: getComputedStyle(document.getElementById('reading-title')!).fontFamily };
    });
    expect(values.actual).toBe(values.expected);
    expect(values.font).toContain('Inter'); expect(values.headingFont).toContain('Playfair Display');
    expect(values.primary).toBe(values.expectedPrimary);
    if (info.project.name === 'chromium') await page.screenshot({ path: info.outputPath(`theme-${palette}-${theme}.png`) });
  });
}

test('motion preference controls Ionic animation and rapid reopening remains usable', async ({ page }) => {
  await page.addInitScript(() => {
    const observed = window;
    observed.modalPlaybackDurations = [];
    const play = Animation.prototype.play;
    Animation.prototype.play = function () {
      const effect = this.effect as KeyframeEffect | null;
      const target = effect?.target;
      const root = target?.getRootNode();
      if (target?.closest('ion-modal') || (root instanceof ShadowRoot && root.host.closest('ion-modal'))) {
        observed.modalPlaybackDurations.push(Number(effect?.getTiming().duration));
      }
      return play.call(this);
    };
  });
  const playback = () => page.evaluate(() => window.modalPlaybackDurations);
  await load(page, 'runtime=native&mode=ios'); await open(page);
  expect(await page.locator('ion-modal').evaluate((node) => (node as HTMLIonModalElement).animated)).toBe(false);
  expect((await playback()).some((duration) => duration > 0)).toBe(false);
  await page.getByRole('button', { name: 'Close reading note', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.evaluate(() => { window.modalPlaybackDurations = []; });
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await open(page);
  expect(await page.locator('ion-modal').evaluate((node) => (node as HTMLIonModalElement).animated)).toBe(true);
  expect((await playback()).some((duration) => duration > 0)).toBe(true);
  await page.getByRole('button', { name: 'Close reading note', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add reading note', exact: true })).toBeFocused();
});

test('forced colors retains visible keyboard focus on date controls', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' }); await load(page); await open(page);
  const trigger = page.getByRole('button', { name: 'Choose reading date', exact: true });
  await trigger.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  await expect(trigger).toBeFocused();
  const outline = await trigger.evaluate((node) => ({ width: getComputedStyle(node).outlineWidth, style: getComputedStyle(node).outlineStyle }));
  expect(outline.width).not.toBe('0px'); expect(outline.style).not.toBe('none');
});
