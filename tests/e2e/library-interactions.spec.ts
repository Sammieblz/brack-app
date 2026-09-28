import { expect, test, type Locator, type Page } from '@playwright/test';

type View = 'flat' | 'bookshelf' | 'carousel';
const views: View[] = ['flat', 'bookshelf', 'carousel'];
const title = 'Open Water';
const bookId = 'fixture-book-0';
const surfaceSelector = (view: View) => view === 'bookshelf' ? '.library-shelf-book' : view === 'carousel' ? '.library-carousel-card' : '.library-book-surface';

async function localOnly(page: Page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:8085' || url.protocol === 'data:' ? route.continue() : route.abort();
  });
}

async function load(page: Page, query: string, width = 1280) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/?${query}`);
  await expect(page.getByTestId('library')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.libraryFixture));
}

async function clickPoint(page: Page, target: Locator, edge = false) {
  await target.scrollIntoViewIfNeeded();
  const rect = await target.boundingBox();
  expect(rect).not.toBeNull();
  // Mid-edge stays within the rounded card; the extreme corner intentionally
  // belongs to the surrounding page, not to the book.
  await page.mouse.click(rect!.x + (edge ? 3 : rect!.width / 2), rect!.y + (edge ? Math.min(30, rect!.height / 2) : rect!.height / 2));
}

async function events(page: Page) {
  return page.evaluate(() => window.libraryEvents);
}

async function reset(page: Page) {
  await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
    window.libraryFixture.reset();
  });
  await expect(page.getByTestId('events')).toHaveText('[]');
}

async function expectOpenedOnce(page: Page, view: View) {
  if (view !== 'flat') {
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(dialog).toHaveCount(1);
    expect(await events(page)).toEqual([]);
    await dialog.getByRole('button', { name: 'View details', exact: true }).click();
    await expect.poll(() => events(page)).toEqual([{ action: 'view', id: bookId }]);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  } else {
    await expect.poll(() => events(page)).toEqual([{ action: 'view', id: bookId }]);
  }
  await expect(page.getByTestId('path')).toHaveText(`/book/${bookId}`);
}

test.beforeEach(async ({ page }) => localOnly(page));

for (const view of views) {
  test(`${view}: cover, title, metadata, progress and padding activate the current book once`, async ({ page }) => {
    await load(page, `view=${view}`);
    const surface = page.locator(surfaceSelector(view)).first();
    const regions = view === 'bookshelf' ? [
      surface.locator('.library-shelf-cover'), surface.locator('.library-shelf-title'),
      surface.locator('.library-shelf-status'), surface.locator('.library-shelf-progress'),
    ] : [
      surface.locator('.library-physical-book'), surface.getByRole('heading', { name: title, exact: true }),
      surface.getByText('by Caleb Azumah Nelson', { exact: true }),
      surface.getByText('Fiction', { exact: true }), surface.getByRole('progressbar'),
    ];
    for (const region of regions) {
      await clickPoint(page, region);
      await expectOpenedOnce(page, view);
      await reset(page);
    }
    await clickPoint(page, surface, true);
    await expectOpenedOnce(page, view);
  });

  test(`${view}: native Enter/Space activation and predictable focus restoration`, async ({ page }) => {
    await load(page, `view=${view}`, 390);
    const primary = page.getByRole('button', { name: `Open ${title}`, exact: true });
    const focusBefore = await page.evaluate(() => ({ documentHasFocus: document.hasFocus(), active: document.activeElement?.tagName }));
    await page.keyboard.press('Tab');
    const firstTab = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement;
      return { documentHasFocus: document.hasFocus(), tag: active.tagName, id: active.id,
        overflowY: getComputedStyle(active).overflowY, scrollHeight: active.scrollHeight, clientHeight: active.clientHeight };
    });
    // Firefox includes this real scrolling surface in its native Tab order.
    // Permit that one named container, then require the first book immediately.
    if (firstTab.id === 'root') {
      expect(firstTab.overflowY).toMatch(/^(auto|scroll)$/);
      expect(firstTab.scrollHeight).toBeGreaterThan(firstTab.clientHeight);
      await page.keyboard.press('Tab');
    }
    await test.info().attach('initial-tab-focus', {
      contentType: 'application/json',
      body: JSON.stringify({ before: focusBefore, firstTab, after: await page.evaluate(() => ({ documentHasFocus: document.hasFocus(), tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label') })) }),
    });
    await expect(primary).toBeFocused();
    for (const key of ['Enter', 'Space']) {
      await primary.focus();
      await primary.press(key);
      if (view !== 'flat') {
        const dialog = page.getByRole('dialog', { name: title, exact: true });
        await expect(dialog).toBeVisible();
        expect(await events(page)).toEqual([]);
        // The default focused action opens a tooltip. Focus the plain Close
        // control so Escape is testing the preview layer, not that tooltip.
        await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(primary).toBeFocused();
      } else {
        expect(await events(page)).toEqual([{ action: 'view', id: bookId }]);
      }
      await reset(page);
    }
    expect(await primary.evaluate((element) => element.tagName)).toBe('BUTTON');
    expect(await primary.locator('button, a, input').count()).toBe(0);
  });

  test(`${view}: selection uses one control and does not navigate or open`, async ({ page }) => {
    await load(page, `view=${view}&select=1`, 390);
    const primary = page.getByRole('button', { name: `Select ${title}`, exact: true });
    await expect(primary).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await clickPoint(page, page.locator(surfaceSelector(view)).first());
    await expect(primary).toHaveAttribute('aria-pressed', 'true');
    expect(await events(page)).toEqual([{ action: 'select', id: bookId }]);
    await primary.press('Space');
    await expect(primary).toHaveAttribute('aria-pressed', 'false');
    expect(await events(page)).toEqual([{ action: 'select', id: bookId }, { action: 'select', id: bookId }]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('path')).toHaveText('/library');
    await expect(page.getByRole('button', { name: 'Delete book', exact: true })).toHaveCount(0);
  });

  test(`${view}: target bounds stay fixed at pointer edges, across widths and themes`, async ({ page }) => {
    await load(page, `view=${view}&long=1`);
    const surface = page.locator(surfaceSelector(view)).first();
    const primary = surface.locator(view === 'bookshelf' ? '.library-shelf-primary' : '.library-book-primary');
    for (const width of [320, 390, 834, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await surface.scrollIntoViewIfNeeded();
      for (const dark of [false, true]) {
        await page.evaluate((dark) => window.libraryFixture.setTheme('default', dark), dark);
        const before = await primary.boundingBox();
        expect(before).not.toBeNull();
        expect(before!.width).toBeGreaterThanOrEqual(44);
        expect(before!.height).toBeGreaterThanOrEqual(44);
        await page.mouse.move(before!.x + 2, before!.y + Math.min(30, before!.height / 2));
        await page.evaluate(async () => {
          for (let frame = 0; frame < 16; frame += 1) await new Promise(requestAnimationFrame);
        });
        const after = await primary.boundingBox();
        expect(after).not.toBeNull();
        for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after![key] - before![key])).toBeLessThan(0.5);
        const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.library-book-surface, .library-shelf-book')?.className, {
          x: before!.x + 2, y: before!.y + Math.min(30, before!.height / 2),
        });
        expect(hit).toBeTruthy();
      }
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await primary.focus();
    const themeIds = await page.evaluate(() => window.libraryFixture.themes);
    for (const theme of themeIds) {
      for (const dark of [false, true]) {
        await page.evaluate(({ theme, dark }) => window.libraryFixture.setTheme(theme, dark), { theme, dark });
        const style = await primary.evaluate((element) => {
          const style = getComputedStyle(element);
          return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, transform: style.transform };
        });
        expect(style.outlineStyle).not.toBe('none');
        expect(parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2);
        expect(style.transform).toBe('none');
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
    await expect(primary).toBeFocused();
    expect(await primary.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
    expect(await events(page)).toEqual([]);
  });
}

test('nested actions, accordion and portalled deletion never activate their card', async ({ page }) => {
  for (const view of ['flat', 'carousel'] as const) {
    await load(page, `view=${view}`);
    const surface = page.locator(surfaceSelector(view)).first();
    if (view === 'flat') {
      await surface.getByRole('button', { name: `Expand ${title}` }).click();
      await expect(surface.getByText('A note worth coming back to.')).toBeVisible();
      expect(await events(page)).toEqual([]);
    }
    await surface.getByRole('button', { name: 'Edit book', exact: true }).click();
    expect(await events(page)).toEqual([{ action: 'edit', id: bookId }]);
    await reset(page);
    await surface.getByRole('button', { name: 'Log progress', exact: true }).click();
    await expect(page.getByTestId('path')).toHaveText(`/book/${bookId}/progress`);
    expect(await events(page)).toEqual([]);
    await reset(page);
    await surface.getByRole('button', { name: 'Delete book', exact: true }).click();
    const confirmation = page.getByRole('alertdialog');
    await expect(confirmation).toBeVisible();
    expect(await events(page)).toEqual([]);
    if (view === 'carousel') {
      // Portalled descendants still bubble through React. Their arrows belong
      // to the confirmation, never to the carousel underneath it.
      await confirmation.getByRole('button', { name: 'Keep book', exact: true }).press('ArrowRight');
      await confirmation.getByRole('button', { name: 'Keep book', exact: true }).press('ArrowLeft');
      await expect(page.getByRole('button', { name: `Go to ${title}`, exact: true, includeHidden: true })).toHaveAttribute('aria-current', 'true');
      await expect(page.getByText('1 of 8', { exact: true })).toBeVisible();
      expect(await events(page)).toEqual([]);
    }
    await confirmation.getByRole('button', { name: 'Keep book', exact: true }).click();
    expect(await events(page)).toEqual([]);
    await surface.getByRole('button', { name: 'Delete book', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect.poll(() => events(page)).toEqual([{ action: 'delete', id: bookId }]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('shelf keyboard reorder preserves sortable behavior and never opens a book', async ({ page }) => {
  await load(page, 'view=bookshelf&reorder=1');
  const first = page.getByRole('button', { name: `Move ${title}`, exact: true });
  await first.focus();
  await first.press('Space');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await first.press('ArrowRight');
  await first.press('Space');
  await expect.poll(() => events(page)).toEqual([{ action: 'reorder', id: 'fixture-book-1,fixture-book-0,fixture-book-2,fixture-book-3,fixture-book-4,fixture-book-5,fixture-book-6,fixture-book-7' }]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(first).toBeFocused();
});

test('shelf pointer reorder keeps the whole book draggable without opening', async ({ page }) => {
  await load(page, 'view=bookshelf&reorder=1');
  const first = await page.getByRole('button', { name: `Move ${title}`, exact: true }).boundingBox();
  const second = await page.getByRole('button', { name: 'Move Shelf book 2', exact: true }).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  const start = { x: first!.x + first!.width / 2, y: first!.y + first!.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y, { steps: 3 });
  await expect(page.getByRole('button', { name: `Move ${title}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(second!.x + second!.width / 2, second!.y + second!.height / 2, { steps: 12 });
  await expect(page.getByRole('status').filter({ hasText: 'was moved over droppable area fixture-book-1' })).toHaveCount(1);
  await page.mouse.up();
  await expect.poll(() => events(page)).toEqual([{ action: 'reorder', id: 'fixture-book-1,fixture-book-0,fixture-book-2,fixture-book-3,fixture-book-4,fixture-book-5,fixture-book-6,fixture-book-7' }]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('dragging a carousel cover changes slides without opening the card', async ({ page }) => {
  await load(page, 'view=carousel', 390);
  const card = await page.locator('.library-carousel-card').first().boundingBox();
  expect(card).not.toBeNull();
  const y = card!.y + 90;
  await page.mouse.move(card!.x + card!.width - 30, y);
  await page.mouse.down();
  await page.mouse.move(card!.x + 24, y, { steps: 14 });
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await events(page)).toEqual([]);
  await expect(page.getByText('2 of 8', { exact: true })).toBeVisible();
});

test('touch swipe reveals actions without opening and a later tap remains usable', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Real touch movement is injected through Chromium CDP; the shared gesture state machine also has unit coverage.');
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 1000 } });
  const page = await context.newPage();
  await localOnly(page);
  await load(page, 'view=flat&swipe=1', 390);
  const card = await page.locator('.library-book-surface').first().boundingBox();
  expect(card).not.toBeNull();
  const session = await context.newCDPSession(page);
  const y = card!.y + 70;
  const startX = card!.x + card!.width - 25;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
  for (let step = 1; step <= 12; step += 1) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - step * 13, y }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('button', { name: 'Mark as complete', exact: true }).first()).toBeVisible();
  expect(await events(page)).toEqual([]);
  await page.getByRole('button', { name: 'Mark as complete', exact: true }).first().tap();
  await expect.poll(() => events(page)).toEqual([{ action: 'status', id: bookId }]);
  await reset(page);
  await expect.poll(async () => Math.abs((await page.locator('.library-book-surface').first().boundingBox())!.x - card!.x)).toBeLessThan(0.5);
  await page.touchscreen.tap(card!.x + 5, card!.y + 30);
  await expect.poll(() => events(page)).toEqual([{ action: 'view', id: bookId }]);
  await context.close();
});

for (const interruption of ['touchcancel', 'second-finger'] as const) {
  test(`interrupted row swipe (${interruption}) restores the card and permits a fresh tap`, async ({ browser, browserName }) => {
    test.skip(browserName !== 'chromium', 'Browser touch input uses Chromium CDP; this does not claim native device gesture support.');
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 1000 } });
    const page = await context.newPage();
    await localOnly(page);
    await load(page, 'view=flat&swipe=1', 390);
    const card = page.locator('.library-book-surface').first();
    const initial = (await card.boundingBox())!;
    const y = initial.y + 70;
    const startX = initial.x + initial.width - 25;
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: startX, y }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: startX - step * 13, y }] });
    }
    await expect.poll(async () => initial.x - (await card.boundingBox())!.x).toBeGreaterThan(50);
    if (interruption === 'touchcancel') {
      await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    } else {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ id: 1, x: startX - 104, y }, { id: 2, x: startX - 40, y: y + 40 }],
      });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await expect.poll(async () => Math.abs((await card.boundingBox())!.x - initial.x)).toBeLessThan(0.5);
    await expect(page.getByRole('button', { name: 'Mark as complete', exact: true })).toHaveCount(0);
    expect(await events(page)).toEqual([]);
    await page.touchscreen.tap(initial.x + 5, initial.y + 30);
    await expect.poll(() => events(page)).toEqual([{ action: 'view', id: bookId }]);
    await context.close();
  });
}
