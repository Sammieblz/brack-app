import { expect, test, type Page } from '@playwright/test';

async function geometry(page: Page) {
  return page.evaluate(() => {
    const scroll = document.querySelector<HTMLElement>('[data-app-scroll-container]')!;
    const header = scroll.querySelector('header')!;
    const content = document.querySelector('#library-scroll, #journey-scroll')!;
    const rect = header.getBoundingClientRect();
    const title = header.querySelector('h1')!.getBoundingClientRect();
    return { headerHeight: rect.height, headerTop: rect.top, scrollTop: scroll.scrollTop,
      contentOffset: content.getBoundingClientRect().top + scroll.scrollTop,
      documentScroll: window.scrollY, headerText: header.querySelector('h1')!.textContent,
      titleTop: title.top, titleLeft: title.left, ownerCount: document.querySelectorAll('[data-app-scroll-container]').length,
      maxScroll: scroll.scrollHeight - scroll.clientHeight };
  });
}

const viewRoutes = [
  '/my-books?view=flat', '/my-books?view=bookshelf', '/my-books?view=carousel',
  '/achievements', '/achievements?tab=quests', '/achievements?tab=shop',
  '/achievements?tab=badges', '/achievements?tab=rankings',
];

for (const width of [320, 390, 768, 834, 1024, 1440]) {
  for (const route of viewRoutes) {
    test(`${width}px down/up preserves one scroll owner: ${route}`, async ({ page }) => {
      await openFixture(page, route, width);
      const initial = await geometry(page);
      expect(initial.ownerCount).toBe(1);
      expect(initial.maxScroll).toBeGreaterThan(100);
      if (route.includes('bookshelf')) await expect(page.getByRole('region', { name: 'Interactive bookshelf' })).toBeVisible();
      if (route.includes('carousel')) await expect(page.getByRole('region', { name: 'Library carousel' })).toBeVisible();
      for (const target of [90, 45, 0]) {
        await page.locator('[data-app-scroll-container]').evaluate((element, top) => { element.scrollTop = top; }, target);
        await page.waitForTimeout(160);
        const actual = await geometry(page);
        expect(actual.headerHeight).toBeCloseTo(initial.headerHeight, 0);
        expect(actual.contentOffset).toBeCloseTo(initial.contentOffset, 0);
        expect(actual.scrollTop).toBeCloseTo(target, 0);
        expect(actual.headerTop).toBeCloseTo(initial.headerTop, 0);
        expect(actual.titleTop).toBeCloseTo(initial.titleTop, 0);
        expect(actual.titleLeft).toBeCloseTo(initial.titleLeft, 0);
        expect(actual.documentScroll).toBe(0);
      }
    });
  }
}

for (const route of ['/my-books', '/achievements']) {
  test(`sidebar resize and large text retain scroll geometry: ${route}`, async ({ page }) => {
    await openFixture(page, route, 1440, true);
    for (const textSize of [16, 32]) {
      await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px`; }, textSize);
      for (const width of [1440, 1024, 834]) {
        await page.setViewportSize({ width, height: 700 });
        for (let iteration = 0; iteration < 2; iteration++) {
          await page.getByRole('button', { name: 'Toggle sidebar' }).click();
          await page.waitForTimeout(350);
          const initial = await geometry(page);
          await page.locator('[data-app-scroll-container]').evaluate(element => { element.scrollTop = 90; });
          await page.waitForTimeout(200);
          const scrolled = await geometry(page);
          expect(scrolled.headerHeight).toBeCloseTo(initial.headerHeight, 0);
          expect(scrolled.contentOffset).toBeCloseTo(initial.contentOffset, 0);
          expect(scrolled.documentScroll).toBe(0);
          await page.locator('[data-app-scroll-container]').evaluate(element => { element.scrollTop = 0; });
        }
      }
    }
  });
}

for (const route of ['/my-books', '/achievements?tab=rankings']) {
  test(`palette, motion and simulated safe inset preserve geometry: ${route}`, async ({ page }) => {
    await openFixture(page, route, 390);
    const palettes = ['paper', 'glass', 'comic', 'coloring-book'];
    for (let index = 0; index < palettes.length; index++) {
      for (const dark of [false, true]) {
        const reduced = dark === (index % 2 === 0);
        await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light', reducedMotion: reduced ? 'reduce' : 'no-preference' });
        await page.evaluate(({ palette, dark }) => {
          document.documentElement.dataset.brackThemeStyle = palette;
          document.documentElement.classList.toggle('dark', dark);
          const owner = document.querySelector<HTMLElement>('[data-app-scroll-container]')!;
          owner.style.setProperty('--app-safe-top', '0px');
          owner.scrollTop = 0;
        }, { palette: palettes[index], dark });
        await page.waitForTimeout(150);
        const withoutInset = await geometry(page);
        await page.locator('[data-app-scroll-container]').evaluate(element => {
          (element as HTMLElement).style.setProperty('--app-safe-top', '24px');
        });
        await page.waitForTimeout(100);
        const before = await geometry(page);
        expect(before.headerTop).toBe(0);
        expect(before.headerHeight).toBe(withoutInset.headerHeight + 24);
        expect(before.titleTop).toBe(withoutInset.titleTop + 24);
        await page.locator('[data-app-scroll-container]').evaluate(element => { element.scrollTop = 100; });
        await page.waitForTimeout(150);
        const after = await geometry(page);
        expect(after.headerHeight).toBe(before.headerHeight);
        expect(after.headerTop).toBe(0);
        expect(after.scrollTop).toBe(100);
        expect(after.contentOffset).toBe(before.contentOffset);
        expect(after.documentScroll).toBe(0);
      }
    }
  });
}

test('Journey tabs only scroll their own horizontal rail, including keyboard changes', async ({ page }) => {
  await openFixture(page, '/achievements', 320);
  await page.locator('[data-app-scroll-container]').evaluate(element => { element.scrollTop = 180; });
  const initial = await geometry(page);
  for (const name of ['Quests', 'Shop', 'Badges', 'League', 'Overview']) {
    // Radix selects on mousedown. Dispatch it directly to isolate the rail's
    // effect from Playwright's scroll-into-view; keyboard is exercised below.
    await page.getByRole('tab', { name, exact: true }).dispatchEvent('mousedown', { button: 0 });
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('data-state', 'active');
    await page.waitForTimeout(180);
    expect((await geometry(page)).scrollTop, `pointer-selected ${name}`).toBe(initial.scrollTop);
    expect((await geometry(page)).documentScroll).toBe(0);
  }
  await page.getByRole('tab', { name: 'Overview', exact: true }).focus();
  const keyboardStart = await geometry(page);
  for (let count = 0; count < 4; count++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    expect((await geometry(page)).scrollTop, `keyboard ArrowRight ${count + 1}`).toBe(keyboardStart.scrollTop);
    expect((await geometry(page)).documentScroll).toBe(0);
  }
});

test('Journey reserves its header while data arrives and keeps later content anchored', async ({ page }) => {
  await openFixture(page, '/achievements?loading=1', 390);
  const beforeLoad = await geometry(page);
  await page.evaluate(() => window.dispatchEvent(new Event('fixture:journey-ready')));
  await expect(page.locator('[data-fixture-journey-content]')).toBeVisible();
  const loaded = await geometry(page);
  expect(loaded.headerHeight).toBeCloseTo(beforeLoad.headerHeight, 0);
  await page.locator('[data-app-scroll-container]').evaluate(element => { element.scrollTop = 180; });
  const beforeAppend = await geometry(page);
  await page.getByRole('button', { name: 'Load additional reading history' }).evaluate(element => (element as HTMLElement).click());
  await expect(page.getByText('Reading milestone 25', { exact: true })).toBeAttached();
  const appended = await geometry(page);
  expect(appended.headerHeight).toBe(beforeAppend.headerHeight);
  expect(appended.scrollTop).toBe(beforeAppend.scrollTop);
  expect(appended.contentOffset).toBe(beforeAppend.contentOffset);
});

for (const width of [390, 834, 1440]) {
  test(`League current-reader strip clears the measured header at ${width}px`, async ({ page }) => {
    await openFixture(page, '/achievements?tab=rankings', width);
    const strip = page.getByRole('status').filter({ hasText: 'You' });
    await expect(strip).toBeAttached();
    for (const size of [16, 24]) {
      await page.evaluate(fontSize => { document.documentElement.style.fontSize = `${fontSize}px`; }, size);
      await page.locator('[data-app-scroll-container]').evaluate(element => { element.scrollTop = 1600; });
      await page.waitForTimeout(200);
      const header = await page.locator('[data-app-scroll-container] header').boundingBox();
      const current = await strip.boundingBox();
      expect(current!.y).toBeCloseTo(header!.y + header!.height + size * 0.75, 0);
      expect((await geometry(page)).documentScroll).toBe(0);
    }
  });

  test(`Library anchors and focused controls clear the header at ${width}px`, async ({ page }) => {
    await openFixture(page, '/my-books?view=flat', width);
    const target = page.locator('#book-fixture-book-12');
    await target.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    const header = await page.locator('[data-app-scroll-container] header').boundingBox();
    const card = await target.boundingBox();
    expect(card!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    await page.locator('[data-app-scroll-container]').evaluate(element => { element.scrollTop = 0; });
    await target.getByRole('button', { name: 'Open Reading collection 13 cover', exact: true }).focus();
    const focused = await page.locator(':focus').boundingBox();
    expect(focused!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    expect((await geometry(page)).documentScroll).toBe(0);
  });
}

test('delayed Library covers preserve the reading position', async ({ page }) => {
  let releaseImages: (() => void) | undefined;
  const imagesReady = new Promise<void>(resolve => { releaseImages = resolve; });
  await page.route('**/brack-mark.webp', async route => {
    await imagesReady;
    await route.continue();
  });
  await openFixture(page, '/my-books?view=flat', 1024);
  await page.locator('[data-app-scroll-container]').evaluate(element => { element.scrollTop = 250; });
  const before = await geometry(page);
  releaseImages!();
  await expect.poll(() => page.locator('#book-fixture-book-0 img').first().evaluate(image => (image as HTMLImageElement).complete)).toBe(true);
  const after = await geometry(page);
  expect(after.headerHeight).toBe(before.headerHeight);
  expect(after.contentOffset).toBe(before.contentOffset);
  expect(after.scrollTop).toBe(before.scrollTop);
});

test('last Library control clears mobile navigation at 200 percent text', async ({ page }) => {
  await openFixture(page, '/my-books?view=flat', 390);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'End of library fixture control';
    button.style.minHeight = '44px';
    document.querySelector('#library-scroll')!.append(button);
  });
  const last = page.getByRole('button', { name: 'End of library fixture control' });
  await last.evaluate(element => element.scrollIntoView({ block: 'end', behavior: 'instant' }));
  await last.focus();
  const control = await last.boundingBox();
  const nav = await page.getByRole('navigation').boundingBox();
  expect(control!.y + control!.height).toBeLessThanOrEqual(nav!.y);
  expect((await geometry(page)).documentScroll).toBe(0);
});

test('late header font metrics update the measured League clearance', async ({ page }) => {
  await openFixture(page, '/achievements?tab=rankings', 834);
  const initial = await geometry(page);
  // A deterministic font-metric change, not an external font download test.
  await page.locator('[data-app-scroll-container] header h1').evaluate(element => {
    const title = element as HTMLElement;
    title.style.fontFamily = 'monospace';
    title.style.fontSize = '2.75rem';
    title.style.lineHeight = '1.6';
  });
  await expect.poll(async () => (await geometry(page)).headerHeight).toBeGreaterThan(initial.headerHeight);
  await expect.poll(() => page.locator('[data-app-scroll-container]').evaluate(element => {
    const measured = Number.parseFloat((element as HTMLElement).style.getPropertyValue('--app-header-height'));
    return Math.abs(measured - element.querySelector('header')!.getBoundingClientRect().height);
  })).toBeLessThan(0.5);
  await page.locator('[data-app-scroll-container]').evaluate(element => { element.scrollTop = 1600; });
  const header = await page.locator('[data-app-scroll-container] header').boundingBox();
  const strip = await page.getByRole('status').filter({ hasText: 'You' }).boundingBox();
  expect(strip!.y).toBeCloseTo(header!.y + header!.height + 12, 0);
  expect((await geometry(page)).documentScroll).toBe(0);
});

test('mobile League scope picker keeps its accessible label and all ranking groups', async ({ page }) => {
  await openFixture(page, '/achievements?tab=rankings', 390);
  const scope = page.getByRole('combobox', { name: 'Ranking group', exact: true });
  await expect(scope).toHaveValue('league');
  for (const value of ['friends', 'global', 'league']) {
    await scope.selectOption(value);
    await expect(scope).toHaveValue(value);
    expect((await geometry(page)).documentScroll).toBe(0);
  }
});

async function openFixture(page: Page, route: string, width: number, expanded = false) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 700 });
  await page.context().addCookies([{ name: 'sidebar:state', value: String(expanded), url: 'http://127.0.0.1:8082' }]);
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.fallback() : route.abort());
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-app-scroll-container] header h1')).toBeVisible().catch(error => {
    throw new Error(`${String(error)}\nBrowser errors: ${[...new Set(errors)].join('\n')}`);
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

for (const route of ['/my-books', '/achievements']) {
  test(`threshold reversal keeps header and page geometry stable: ${route}`, async ({ page }) => {
    await openFixture(page, route, 1024);
    const initial = await geometry(page);
    expect(initial.maxScroll).toBeGreaterThan(150);
    for (const target of [49, 51, 80, 51, 49, 0, 70, 20, 0]) {
      await page.locator('[data-app-scroll-container]').evaluate((element, top) => { element.scrollTop = top; }, target);
      await page.waitForTimeout(380);
      const actual = await geometry(page);
      expect.soft(actual.headerHeight, `header height at ${target}px: ${JSON.stringify(actual)}`).toBeCloseTo(initial.headerHeight, 0);
      expect.soft(actual.contentOffset, `content flow at ${target}px: ${JSON.stringify(actual)}`).toBeCloseTo(initial.contentOffset, 0);
      expect.soft(actual.scrollTop, `scroll position at ${target}px`).toBeCloseTo(target, 0);
      expect.soft(actual.documentScroll).toBe(0);
      expect.soft(actual.headerTop).toBeCloseTo(initial.headerTop, 0);
    }
  });
}
