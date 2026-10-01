import { test, expect, type Page, type Locator } from '@playwright/test';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => { const messages: string[] = []; errors.set(page, messages); page.on('pageerror', error => messages.push(error.message)); });
test.afterEach(async ({ page }, info) => {
  await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' });
  expect(errors.get(page)).toEqual([]);
});
async function open(page: Page, path: string, width = 834) {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
}
for (const path of ['/lists', '/book-lists', '/goals-management']) {
  test(`signed-out recovery ${path}`, async ({ page }) => {
    await open(page, `${path}?anonymous`);
    await expect(page.getByRole('heading', { name: /Sign in to/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute('href', `/auth?mode=signin&returnTo=${encodeURIComponent(path)}`);
  });
}
test('unavailable club expanded Back', async ({ page }) => {
  await open(page, '/clubs/club-one?club=404', 1280);
  await expect(page.getByText('This club could not load.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go back', exact: true })).toBeVisible();
});

for (const path of ['/lists', '/book-lists', '/goals-management']) {
  test(`actual sign-in returns to ${path} and consumes the intent`, async ({ page }) => {
    await open(page, `${path}?anonymous`, 390);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill('reader@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('FixturePassword12!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { name: path === '/goals-management' ? '7 Books' : 'Weekend reading', exact: true })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('brack:auth-return:v1'))).toBeNull();
  });
  test(`session loss and resolving old account tear down ${path}`, async ({ page }) => {
    await open(page, path);
    const heading = page.getByRole('heading', { name: path === '/goals-management' ? '7 Books' : 'Weekend reading', exact: true });
    await expect(heading).toBeVisible();
    await page.evaluate(() => window.routeRecovery!.setAuth('shell-reader', true));
    await expect(heading).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Sign in to/ })).toHaveCount(0);
    await page.evaluate(() => window.routeRecovery!.setAuth(null));
    await expect(page.getByRole('heading', { name: /Sign in to/ })).toBeVisible();
    await expect(heading).toHaveCount(0);
    await page.evaluate(() => window.routeRecovery!.setAuth('another-reader'));
    await expect(page.getByRole('heading', { name: /Sign in to/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: path === '/goals-management' ? '12 Books' : 'Weekend reading', exact: true })).toBeVisible();
  });
}

test('explicit auth cancellation clears the destination', async ({ page }) => {
  await open(page, '/lists?anonymous');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('brack:auth-return:v1'))).not.toBeNull();
  await page.getByRole('button', { name: 'Back to Brack home', exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('brack:auth-return:v1'))).toBeNull();
  await expect(page).toHaveURL('/');
});

for (const width of [390, 834, 1280]) {
  test(`club recovery and retry ${width}`, async ({ page }) => {
    for (const state of ['empty', '401', '403', '404', 'network']) {
      await open(page, `/clubs/club-one?club=${state}`, width);
      const back = page.getByRole('button', { name: 'Go back', exact: true });
      await expect(back).toHaveCount(1);
      await usable(back);
      if (state === 'network') {
        await page.evaluate(() => window.routeRecovery!.setClubMode('ready'));
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'The Chapter Circle', exact: true }).last()).toBeVisible();
      }
      await back.click();
      await expect(page).toHaveURL('/clubs');
      await expect(page.getByRole('link', { name: 'Open Reading Circle', exact: true }).first()).toBeVisible();
    }
  });
}
test('club Back follows verified internal ancestry', async ({ page }) => {
  await open(page, '/my-books?club=404', 1280);
  await expect(page.getByRole('heading', { name: 'My Library' })).toBeVisible();
  await page.evaluate(() => window.routeRecovery!.navigate('/clubs/club-one'));
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Library' })).toBeVisible();
});

async function usable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate(node => {
    const box = node.getBoundingClientRect();
    let top = 0, left = 0, right = innerWidth, bottom = innerHeight;
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
    }
    return box.left >= left - 1 && box.right <= right + 1 && box.top >= top - 1 && box.bottom <= bottom + 1 &&
      [0.1, 0.5, 0.9].every(ratio => { const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height * ratio); return hit === node || node.contains(hit); });
  })).toBe(true);
}

for (const profile of [{ name: 'phone', width: 390, text: 100 }, { name: 'compact200', width: 320, text: 200 },
  { name: 'tablet200', width: 834, text: 200 }, { name: 'desktop', width: 1280, text: 100 }, { name: 'tabletDark', width: 834, text: 100, theme: 'dark' }]) {
  test(`visual recovery and Library ${profile.name}`, async ({ page }, info) => {
    for (const path of ['/lists', '/goals-management', '/clubs/club-one', '/my-books']) {
      await open(page, `${path}?${path.includes('lists') || path.includes('goals') ? 'anonymous&' : ''}club=404&text=${profile.text}&theme=${profile.theme ?? 'light'}`, profile.width);
      const fonts = await page.evaluate(async () => {
        await Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(font => document.fonts.load(`16px "${font}"`)));
        await document.fonts.ready;
        return ['Inter', 'Merriweather', 'Playfair Display'].map(family => ({ family, loaded: [...document.fonts].some(face => face.family.replace(/["']/g, '') === family && face.status === 'loaded') }));
      });
      for (const font of fonts) expect(font.loaded, font.family).toBe(true);
      await info.attach(`fonts-${path.replace(/\//g, '-')}`, { body: JSON.stringify(fonts), contentType: 'application/json' });
      if (path === '/my-books') {
        await usable(page.getByRole('link', { name: 'Add Book', exact: true }));
        await page.getByRole('button', { name: 'Library controls', exact: true }).click();
      }
      const names = path === '/my-books' ? ['Book Lists', 'Analytics'] : path.includes('club') ? [] : ['Sign in', 'Back to Brack home'];
      for (const name of names) { const link = page.getByRole('link', { name, exact: true }); await usable(link); await link.focus(); await expect(link).toBeFocused(); }
      if (path.includes('club')) await usable(page.getByRole('button', { name: 'Go back', exact: true }));
      await info.attach(`screen-${path.replace(/\//g, '-')}`, { body: await page.screenshot(), contentType: 'image/png' });
    }
  });
}

test('Library link keyboard activation reaches actual Lists', async ({ page }) => {
  await open(page, '/my-books');
  await page.getByRole('button', { name: 'Library controls', exact: true }).click();
  const link = page.getByRole('link', { name: 'Book Lists', exact: true });
  await link.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Weekend reading', exact: true })).toBeVisible();
});

test('club loading and ready keep one reachable Back', async ({ page }) => {
  for (const width of [390, 834, 1280]) {
    await open(page, '/clubs/club-one?club=loading', width);
    const back = page.getByRole('button', { name: 'Go back', exact: true });
    await expect(back).toHaveCount(1); await usable(back);
    await expect(page.getByRole('heading', { name: 'The Chapter Circle', exact: true })).toHaveCount(0);
    await page.evaluate(() => window.routeRecovery!.setClubMode('ready'));
    await expect(page.getByRole('heading', { name: 'The Chapter Circle', exact: true }).last()).toBeVisible();
    await expect(back).toHaveCount(1); await usable(back);
  }
});

test('tablet touch activates the Lists destination', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 834, height: 1112 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await open(page, '/my-books');
  await page.getByRole('button', { name: 'Library controls', exact: true }).tap();
  await page.getByRole('link', { name: 'Book Lists', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Weekend reading', exact: true })).toBeVisible();
  await context.close();
});

test('tablet Library preserves native modified-click navigation', async ({ page, context }) => {
  await open(page, '/my-books');
  await page.getByRole('button', { name: 'Library controls', exact: true }).click();
  const link = page.getByRole('link', { name: 'Book Lists', exact: true });
  const opened = context.waitForEvent('page');
  await link.click({ modifiers: ['ControlOrMeta'] });
  const popup = await opened;
  await expect(popup.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
  await expect(popup.getByRole('heading', { name: 'Weekend reading', exact: true })).toBeVisible();
  await expect(page).toHaveURL('/my-books');
  await popup.close();
});

test('keyboard traversal reaches the Library controls destinations', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit' && process.platform === 'win32', 'Windows WebKit skips plain anchors with Tab/Alt+Tab; independent capability evidence is retained by CR06a. Native Safari keyboard review remains open.');
  await open(page, '/my-books');
  const trigger = page.getByRole('button', { name: 'Library controls', exact: true });
  await trigger.focus(); await page.keyboard.press('Enter');
  const link = page.getByRole('link', { name: 'Book Lists', exact: true });
  const key = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  for (let i = 0; i < 50 && !(await link.evaluate(node => node === document.activeElement)); i++) await page.keyboard.press(key);
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Weekend reading', exact: true })).toBeVisible();
});
test('tablet Library action names', async ({ page }) => {
  await open(page, '/my-books');
  await expect(page.getByRole('link', { name: 'Add Book', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Library controls', exact: true }).click();
  for (const name of ['Book Lists', 'Analytics']) {
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  }
});
