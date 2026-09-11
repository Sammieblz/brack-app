import { expect, test, type Locator, type Page } from '@playwright/test';

const origin = 'http://127.0.0.1:8083';
const errorsByPage = new Map<Page, string[]>();

const localeLabels = {
  'en-US': { choose: 'Choose date', month: 'Choose month', year: 'Choose year', close: 'Close calendar' },
  'en-GB': { choose: 'Choose date', month: 'Choose month', year: 'Choose year', close: 'Close calendar' },
  'es-ES': { choose: 'Elegir fecha', month: 'Elegir mes', year: 'Elegir año', close: 'Cerrar calendario' },
  'fr-FR': { choose: 'Choisir une date', month: 'Choisir le mois', year: 'Choisir l’année', close: 'Fermer le calendrier' },
};

function triggerName(page: Page, label = 'Reading date') {
  const locale = new URL(page.url()).searchParams.get('locale') ?? 'en-US';
  return `${localeLabels[locale as keyof typeof localeLabels].choose}: ${label}`;
}

async function openFixture(page: Page, query = '', width = 1024) {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`Console: ${message.text()}`);
  });
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin
    ? route.continue()
    : route.abort());
  await page.setViewportSize({ width, height: 850 });
  await page.clock.setFixedTime(new Date('2026-09-11T12:00:00Z'));
  await page.goto(`${origin}/?${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('fixture-heading')).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function openPicker(page: Page, label = 'Reading date') {
  await page.getByRole('button', { name: triggerName(page, label), exact: true }).click();
  const name = page.viewportSize()!.width < 768 ? label : triggerName(page, label);
  const dialog = page.getByRole('dialog', { name, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName(name);
  return dialog;
}

function dateButton(dialog: Locator, year: number, month: number, day: number, locale = 'en-US') {
  const name = new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(new Date(year, month - 1, day));
  return dialog.getByRole('gridcell', { name, exact: true });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
}

async function expectUsableTargets(dialog: Locator) {
  const targets = await dialog.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => {
    const bounds = button.getBoundingClientRect();
    return {
      name: button.getAttribute('aria-label') ?? button.textContent?.trim(),
      width: bounds.width,
      height: bounds.height,
      clipped: button.scrollWidth > button.clientWidth,
    };
  }));
  expect(targets.length).toBeGreaterThan(7);
  for (const target of targets) {
    expect(target.width, `${target.name} target width`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.name} target height`).toBeGreaterThanOrEqual(44);
    expect(target.clipped, `${target.name} text must not spill out of its control`).toBe(false);
  }
}

test.afterEach(async () => {
  for (const [page, errors] of errorsByPage) {
    expect(errors, `Unexpected browser errors on ${page.url()}`).toEqual([]);
  }
  errorsByPage.clear();
});

test('chooses February 5, 1999 through year/month controls without committing navigation', async ({ page }) => {
  await openFixture(page, 'scenario=birth-date&date=2026-09-11');
  const dialog = await openPicker(page, 'Date of birth');
  await dialog.getByRole('button', { name: 'Choose year', exact: true }).click();
  for (let decade = 0; decade < 3; decade += 1) {
    await dialog.getByRole('button', { name: 'Previous decade', exact: true }).click();
  }
  await dialog.getByRole('button', { name: '1999', exact: true }).click();
  await expect(page.getByTestId('committed-date')).toHaveText('2026-09-11');
  await dialog.getByRole('button', { name: 'Choose month', exact: true }).click();
  await dialog.getByRole('button', { name: 'February', exact: true }).click();
  await expect(page.getByTestId('committed-date')).toHaveText('2026-09-11');
  await dateButton(dialog, 1999, 2, 5).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('committed-date')).toHaveText('1999-02-05');
  await page.getByRole('button', { name: 'Save reading dates' }).click();
  await expect(page.getByTestId('saved-date')).toHaveText('1999-02-05');
  const reopened = await openPicker(page, 'Date of birth');
  await expect(dateButton(reopened, 1999, 2, 5)).toBeFocused();
});

for (const [locale, text] of [
  ['en-US', '02/05/1999'],
  ['en-GB', '05/02/1999'],
  ['es-ES', '05/02/1999'],
  ['fr-FR', '05/02/1999'],
] as const) {
  test(`${locale} typed input stores a date-only value and opens the matching calendar day`, async ({ page }) => {
    await openFixture(page, `locale=${locale}&date=`);
    const input = page.getByRole('textbox', { name: 'Reading date', exact: true });
    await input.fill(text);
    await input.press('Tab');
    await expect(page.getByTestId('committed-date')).toHaveText('1999-02-05');
    const dialog = await openPicker(page);
    const labels = localeLabels[locale];
    await expect(dialog.getByRole('button', { name: labels.month, exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: labels.year, exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: labels.close, exact: true })).toBeVisible();
    await expect(dateButton(dialog, 1999, 2, 5, locale)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: triggerName(page), exact: true })).toBeFocused();
  });
}

test('invalid and partial input is preserved without saving the previous committed date', async ({ page }) => {
  await openFixture(page);
  const input = page.getByRole('textbox', { name: 'Reading date', exact: true });
  for (const draft of ['02/30/1999', '02/', '02/29/1900']) {
    await input.fill(draft);
    await input.press('Tab');
    await expect(input).toHaveValue(draft);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('button', { name: 'Save reading dates' })).toBeDisabled();
    await expect(page.getByTestId('committed-date')).toHaveText('1999-02-05');
    await expect(page.getByTestId('saved-date')).toHaveText('not saved');
  }
  await input.fill('02/29/2000');
  await input.press('Tab');
  await expect(page.getByRole('button', { name: 'Save reading dates' })).toBeEnabled();
  await expect(page.getByTestId('committed-date')).toHaveText('2000-02-29');
});

test('optional dates clear, while required empty dates prevent submission', async ({ page }) => {
  await openFixture(page);
  const dialog = await openPicker(page);
  await dialog.getByRole('button', { name: 'Clear date', exact: true }).click();
  await expect(page.getByTestId('committed-date')).toHaveText('empty');
  await expect(page.getByRole('button', { name: 'Save reading dates' })).toBeEnabled();
  await page.goto(`${origin}/?required=1`);
  const input = page.getByRole('textbox', { name: 'Reading date', exact: true });
  await input.fill('');
  await input.press('Tab');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Save reading dates' })).toBeDisabled();
});

test('birth dates reject the future and do not offer Today', async ({ page }) => {
  await openFixture(page, 'scenario=birth-date&date=2026-09-11');
  const dialog = await openPicker(page, 'Date of birth');
  await expect(dialog.getByRole('button', { name: 'Today', exact: true })).toHaveCount(0);
  await expect(dateButton(dialog, 2026, 9, 12)).toBeDisabled();
  await page.keyboard.press('Escape');
  const input = page.getByRole('textbox', { name: 'Date of birth', exact: true });
  await input.fill('09/12/2026');
  await input.press('Tab');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('committed-date')).toHaveText('2026-09-11');
});

test('paired book dates enforce order and the present-day limit', async ({ page }) => {
  await openFixture(page, 'scenario=book&date=2026-09-05');
  const start = page.getByRole('textbox', { name: 'Started reading', exact: true });
  const end = page.getByRole('textbox', { name: 'Finished reading', exact: true });
  await end.fill('09/04/2026');
  await end.press('Tab');
  await expect(end).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Save reading dates' })).toBeDisabled();
  await end.fill('09/11/2026');
  await end.press('Tab');
  await expect(page.getByTestId('finished-date')).toHaveText('2026-09-11');
  await start.fill('09/12/2026');
  await start.press('Tab');
  await expect(start).toHaveAttribute('aria-invalid', 'true');
  await start.fill('09/11/2026');
  await start.press('Tab');
  await expect(page.getByRole('button', { name: 'Save reading dates' })).toBeEnabled();
  await end.fill('09/12/2026');
  await end.press('Tab');
  await expect(end).toHaveAttribute('aria-invalid', 'true');
});

test('an unrestricted goal deadline accepts future dates and Today commits only when chosen', async ({ page }) => {
  await openFixture(page, 'scenario=goal');
  const input = page.getByRole('textbox', { name: 'Reading date', exact: true });
  await input.fill('12/31/2030');
  await input.press('Tab');
  await expect(page.getByTestId('committed-date')).toHaveText('2030-12-31');
  const dialog = await openPicker(page);
  await dialog.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByTestId('committed-date')).toHaveText('2026-09-11');
  await expect(dialog).not.toBeVisible();
});

test('calendar keyboard navigation moves focus without committing until Enter', async ({ page }) => {
  await openFixture(page);
  const dialog = await openPicker(page);
  await expect(dateButton(dialog, 1999, 2, 5)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(dateButton(dialog, 1999, 2, 6)).toBeFocused();
  const normalFocus = await dateButton(dialog, 1999, 2, 6).evaluate((day) => {
    const style = getComputedStyle(day);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      color: style.outlineColor,
    };
  });
  expect(normalFocus.style).toBe('solid');
  expect(normalFocus.width).toBeGreaterThanOrEqual(2);
  expect(normalFocus.color).not.toBe('transparent');
  expect(normalFocus.color).not.toBe('rgba(0, 0, 0, 0)');
  await page.keyboard.press('ArrowDown');
  await expect(dateButton(dialog, 1999, 2, 13)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(dateButton(dialog, 1999, 2, 12)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(dateButton(dialog, 1999, 2, 5)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(dateButton(dialog, 1999, 2, 13)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(dateButton(dialog, 1999, 2, 7)).toBeFocused();
  await page.keyboard.press('End');
  await expect(dateButton(dialog, 1999, 2, 13)).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(dateButton(dialog, 1999, 3, 13)).toBeFocused();
  await page.keyboard.press('PageUp');
  await expect(dateButton(dialog, 1999, 2, 13)).toBeFocused();
  await page.keyboard.press('Shift+PageDown');
  await expect(dateButton(dialog, 2000, 2, 13)).toBeFocused();
  await page.keyboard.press('Shift+PageUp');
  await expect(dateButton(dialog, 1999, 2, 13)).toBeFocused();
  await expect(page.getByTestId('committed-date')).toHaveText('1999-02-05');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('committed-date')).toHaveText('1999-02-13');
  await expect(dialog).not.toBeVisible();
});

test('forced colors retains visible keyboard focus on calendar days and the date field', async ({ page }) => {
  await openFixture(page);
  await page.emulateMedia({ forcedColors: 'active' });
  const trigger = page.getByRole('button', { name: triggerName(page), exact: true });
  await trigger.focus();
  await trigger.press('Enter');
  await page.keyboard.press('ArrowRight');
  const forcedColorDay = dateButton(page.getByRole('dialog'), 1999, 2, 6);
  await expect(forcedColorDay).toBeFocused();
  const expectOutline = async (target: Locator) => {
    const outline = await target.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        active: window.matchMedia('(forced-colors: active)').matches,
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
        color: style.outlineColor,
      };
    });
    expect(outline.active).toBe(true);
    expect(outline.style).toBe('solid');
    expect(outline.width).toBeGreaterThanOrEqual(2);
    expect(outline.color).not.toBe('transparent');
    expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  };
  await expectOutline(forcedColorDay);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.press('Shift+Tab');
  const input = page.getByRole('textbox', { name: 'Reading date', exact: true });
  await expect(input).toBeFocused();
  await expectOutline(input);
});

for (const theme of ['light', 'dark']) {
  for (const text of [100, 200]) {
    test(`${theme} at 320px and ${text}% text keeps calendar controls usable`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' });
      await openFixture(page, `theme=${theme}&text=${text}`, 320);
      const dialog = await openPicker(page);
      await expectNoHorizontalOverflow(page);
      await expectUsableTargets(dialog);
      const day = dateButton(dialog, 1999, 2, 5);
      const bounds = await day.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      await dialog.getByRole('button', { name: 'Choose year', exact: true }).click();
      await expectNoHorizontalOverflow(page);
      await expectUsableTargets(dialog);
      await dialog.getByRole('button', { name: '1999', exact: true }).click();
      await dialog.getByRole('button', { name: 'Choose month', exact: true }).click();
      await expectNoHorizontalOverflow(page);
      await expectUsableTargets(dialog);
      await dialog.getByRole('button', { name: 'February', exact: true }).click();
      await day.click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByTestId('committed-date')).toHaveText('1999-02-05');
    });
  }
}

test('disabled dates cannot open or edit', async ({ page }) => {
  await openFixture(page, 'disabled=1');
  await expect(page.getByRole('textbox', { name: 'Reading date', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Choose date: Reading date', exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a short mobile viewport retains reachable footer actions with safe-area padding', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFixture(page, 'text=200', 390);
  await page.setViewportSize({ width: 390, height: 360 });
  const dialog = await openPicker(page);
  // Desktop engines do not expose a physical notch inset. Exercise the resulting
  // layout with explicit padding, without claiming to emulate an operating system.
  await page.addStyleTag({ content: '[role="dialog"] > div:last-child { padding-bottom: 24px; }' });
  await expectNoHorizontalOverflow(page);
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  const footerBounds = await cancel.boundingBox();
  expect(footerBounds).not.toBeNull();
  expect(footerBounds!.y).toBeGreaterThanOrEqual(0);
  expect(footerBounds!.y + footerBounds!.height).toBeLessThanOrEqual(336);
  await dateButton(dialog, 1999, 2, 20).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('committed-date')).toHaveText('1999-02-20');
});

for (const width of [390, 1024]) {
  test(`a picker nested in an editing dialog restores focus at ${width}px`, async ({ page }) => {
    await openFixture(page, 'scenario=nested', width);
    await page.getByRole('button', { name: 'Edit reading goal', exact: true }).click();
    const editingDialog = page.getByRole('dialog', { name: 'Edit reading goal', exact: true });
    await expect(editingDialog).toBeVisible();
    const picker = await openPicker(page);
    await page.keyboard.press('Escape');
    await expect(picker).not.toBeVisible();
    await expect(editingDialog).toBeVisible();
    await expect(page.getByRole('button', { name: triggerName(page), exact: true })).toBeFocused();
    const reopened = await openPicker(page);
    await dateButton(reopened, 1999, 2, 6).click();
    await expect(reopened).not.toBeVisible();
    await editingDialog.getByRole('button', { name: 'Save reading dates' }).click();
    await expect(page.getByTestId('saved-date')).toHaveText('1999-02-06');
    await page.keyboard.press('Escape');
    await expect(editingDialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit reading goal', exact: true })).toBeFocused();
  });
}

test('Pacific/Apia retains a skipped calendar day instead of shifting its stored value', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'Pacific/Apia', serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await openFixture(page, 'date=2011-12-30');
    await expect(page.getByRole('textbox', { name: 'Reading date', exact: true })).toHaveValue('12/30/2011');
    await expect(page.getByTestId('committed-date')).toHaveText('2011-12-30');
    const dialog = await openPicker(page);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('committed-date')).toHaveText('2011-12-30');
    await page.getByRole('button', { name: 'Save reading dates' }).click();
    await expect(page.getByTestId('saved-date')).toHaveText('2011-12-30');
    await page.goto(`${origin}/?scenario=book&date=2011-12-30`);
    const bounded = await openPicker(page, 'Finished reading');
    await expect(dateButton(bounded, 2026, 9, 10)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(bounded).not.toBeVisible();
    await expect(page.getByTestId('committed-date')).toHaveText('2011-12-30');
    await expect(page.getByTestId('finished-date')).toHaveText('2026-09-10');
  } finally {
    await context.close();
  }
});

for (const timezoneId of ['America/Los_Angeles', 'Pacific/Kiritimati']) {
  test(`${timezoneId} preserves historical and DST-boundary date values in custom and native inputs`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId, serviceWorkers: 'block' });
    const page = await context.newPage();
    try {
      await openFixture(page);
      await expect(page.getByTestId('committed-date')).toHaveText('1999-02-05');
      const input = page.getByRole('textbox', { name: 'Reading date', exact: true });
      for (const [typed, stored] of [['03/08/2026', '2026-03-08'], ['11/01/2026', '2026-11-01']]) {
        await input.fill(typed);
        await input.press('Tab');
        await expect(page.getByTestId('committed-date')).toHaveText(stored);
      }
      await page.goto(`${origin}/?scenario=native`);
      const native = page.getByLabel('Reading date', { exact: true });
      await expect(native).toHaveValue('1999-02-05');
      await native.fill('2026-03-08');
      await expect(page.getByTestId('committed-date')).toHaveText('2026-03-08');
    } finally {
      await context.close();
    }
  });
}
