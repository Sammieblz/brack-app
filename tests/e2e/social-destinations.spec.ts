import { expect, test, type Page, type Locator } from '@playwright/test';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const collected: string[] = []; errors.set(page, collected);
  page.on('pageerror', error => collected.push(error.message));
});
test.afterEach(async ({ page }, info) => {
  await info.attach('page-errors', { body: JSON.stringify(errors.get(page)), contentType: 'application/json' });
  expect(errors.get(page)).toEqual([]);
});
async function ready(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
}
test('Readers exposes a native profile destination without enclosing Follow', async ({ page }) => {
  await ready(page, '/readers');
  const link = page.getByRole('link', { name: 'Taylor Lane', exact: true });
  await expect(link).toHaveAttribute('href', '/users/reader-one');
  expect(await link.locator('button').count()).toBe(0);
  await page.getByRole('button', { name: 'Follow', exact: true }).click();
  expect(await page.evaluate(() => window.destinationActions)).toContain('follow');
  await expect(page).toHaveURL(/\/readers$/);
  await link.click();
  await expect(page).toHaveURL(/\/users\/reader-one$/);
  await expect(page.getByRole('heading', { name: 'Taylor Lane', exact: true })).toBeVisible();
});
test('Review author avatar is a named link', async ({ page }) => {
  await ready(page, '/reviews/review-one');
  await expect(page.getByRole('link', { name: 'Open Taylor Lane profile', exact: true }).first()).toHaveAttribute('href', '/users/reader-one');
});

test('review copy and catalog destinations preserve the book query', async ({ page }) => {
  await ready(page, '/reviews');
  await expect(page.getByRole('link', { name: 'Open my copy', exact: true })).toHaveAttribute('href', '/book/book-one');
  const catalog = page.getByRole('link', { name: 'Find this book', exact: true });
  expect(new URL(await catalog.getAttribute('href') ?? '', 'http://fixture').searchParams.get('query')).toBe('A Room of One’s Own Virginia Woolf');
  await ready(page, '/reviews/review-related');
  const detailCatalog = page.getByRole('link', { name: 'Add or find this book', exact: true });
  expect(new URL(await detailCatalog.getAttribute('href') ?? '', 'http://fixture').searchParams.get('query')).toBe('A Room of One’s Own Virginia Woolf');
  await expect(page.getByRole('link', { name: 'Reading notes', exact: true }).first()).toHaveAttribute('href', 'https://example.org/reading');
});

test('unavailable review has a link back to the actual Reviews screen', async ({ page }) => {
  await ready(page, '/reviews/missing');
  const recovery = page.getByRole('link', { name: 'Back to Reviews', exact: true });
  await expect(recovery).toHaveAttribute('href', '/reviews');
  await recovery.click();
  await expect(page.getByRole('link', { name: 'Space for thought', exact: true })).toBeVisible();
});

test('Reviews trending and empty-library picker expose catalog links', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready(page, '/reviews');
  const trending = page.getByRole('link', { name: 'Find A Room of One’s Own', exact: true });
  expect(new URL(await trending.getAttribute('href') ?? '', 'http://fixture').searchParams.get('query')).toBe('A Room of One’s Own Virginia Woolf');
  await page.getByRole('button', { name: 'Write Review', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search your library', exact: true }).fill('New book & essays');
  const catalog = page.getByRole('link', { name: 'Find or add book', exact: true });
  expect(new URL(await catalog.getAttribute('href') ?? '', 'http://fixture').searchParams.get('query')).toBe('New book & essays');
  const opened = context.waitForEvent('page');
  await catalog.click({ modifiers: ['Control'] });
  const popup = await opened;
  await expect(popup).toHaveURL(/\/add-book\?query=New%20book%20%26%20essays$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search your library' })).toHaveValue('New book & essays');
  await popup.close();
  await catalog.click();
  await expect(page).toHaveURL(/\/add-book\?query=New%20book%20%26%20essays$/);
  // Catalog is explicitly outside this fixture; this assertion covers handoff, not AddBook UI acceptance.
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('social-disabled routes retain the production FeatureGate', async ({ page }) => {
  for (const path of ['/readers', '/feed', '/posts/post-reading', '/users/reader-one', '/reviews', '/reviews/review-one', '/clubs', '/clubs/club-one']) {
    await ready(page, `${path}?social=off`);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: /Taylor Lane|Space for thought|Open Reading Circle/ })).toHaveCount(0);
  }
});

test('keyboard traversal reaches the profile destination', async ({ page, browserName }, info) => {
  test.skip(browserName === 'webkit' && process.platform === 'win32', 'Windows WebKit 26.6 skips even plain HTML anchors with Tab/Alt+Tab; reproduced in cr06-webkit-capability.json. Real Safari keyboard acceptance remains open.');
  await ready(page, '/readers');
  const link = page.getByRole('link', { name: 'Taylor Lane', exact: true });
  await expect(link).toBeVisible();
  // Traverse real tab stops instead of programmatically focusing the desired link.
  // WebKit's default keyboard mode follows Safari's Option-Tab link traversal.
  // https://support.apple.com/en-gb/guide/safari/cpsh003/mac
  const key = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  const stops: string[] = [];
  for (let i = 0; i < 65 && !(await link.evaluate(node => node === document.activeElement)); i++) {
    await page.keyboard.press(key);
    stops.push(await page.evaluate(() => `${document.activeElement?.tagName}: ${document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0, 80)}`));
  }
  await info.attach('keyboard-traversal', { body: JSON.stringify({ key, stops }), contentType: 'application/json' });
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Taylor Lane', exact: true })).toBeVisible();
});

test('Enter and Ctrl-click preserve browser destination behavior', async ({ page, context }) => {
  await ready(page, '/readers');
  const link = page.getByRole('link', { name: 'Taylor Lane', exact: true });
  // Activation is separate from real Tab traversal, which is checked above.
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Taylor Lane', exact: true })).toBeVisible();
  await page.goBack();
  const popupPromise = context.waitForEvent('page');
  await link.click({ modifiers: ['Control'] });
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/users\/reader-one$/);
  await expect(popup.getByRole('heading', { name: 'Taylor Lane', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/readers$/);
  await popup.close();
});

test('middle-click opens the actual profile in another page', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit' && process.platform === 'win32', 'Windows WebKit 26.6 ignores middle-click on plain HTML anchors; reproduced in cr06-webkit-capability-2.json. Ctrl-click is checked separately.');
  await ready(page, '/readers');
  const opened = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Taylor Lane', exact: true }).click({ button: 'middle' });
  const popup = await opened;
  await expect(popup.getByRole('heading', { name: 'Taylor Lane', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/readers$/);
  await popup.close();
});

for (const path of ['/feed', '/posts/post-reading', '/users/reader-one?tab=posts']) {
  test(`PostCard destinations and independent comments at ${path}`, async ({ page }) => {
    await ready(page, path);
    const post = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'A passage to return to', exact: true }) });
    await expect(post.getByRole('link', { name: 'Open Taylor Lane profile' })).toHaveAttribute('href', '/users/reader-one');
    await expect(post.getByRole('link', { name: 'A passage to return to', exact: true })).toHaveAttribute('href', '/posts/post-reading');
    await expect(post.getByRole('link', { name: 'Open A Room of One’s Own', exact: true })).toHaveAttribute('href', '/book/book-one');
    await post.getByRole('button', { name: /^(Like|Unlike)$/ }).click();
    if (!path.startsWith('/users/')) expect(await page.evaluate(() => window.destinationActions)).toContain('post-like');
    // UserProfile intentionally still supplies its existing no-op Like callback; no save is claimed there.
    await expect(page).toHaveURL(new RegExp(path.replace('?', '\\?')+'$'));
    await post.getByRole('button', { name: /comment/i }).click();
    await expect(post.getByRole('textbox', { name: 'Comment', exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(path.replace('?', '\\?')+'$'));
    await post.getByRole('button', { name: 'Post options', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(post.getByRole('button', { name: 'Post options', exact: true })).toBeFocused();
    await post.getByRole('link', { name: 'Open A Room of One’s Own', exact: true }).click();
    await expect(page).toHaveURL(/\/book\/book-one$/);
    await expect(page.getByRole('heading', { name: 'A Room of One’s Own', exact: true }).first()).toBeVisible();
  });
}

test('post club attachment arrives at the actual club', async ({ page }) => {
  await ready(page, '/feed');
  await page.getByRole('link', { name: 'Open The Chapter Circle', exact: true }).click();
  await expect(page).toHaveURL(/\/clubs\/club-one$/);
  await expect(page.getByRole('heading', { name: 'The Chapter Circle', exact: true }).first()).toBeVisible();
});

for (const path of ['/reviews', '/book/book-one', '/reviews/review-one']) {
  test(`ReviewCard destinations and spoiler ownership at ${path}`, async ({ page }) => {
    await ready(page, path);
    if (path.startsWith('/book/')) await page.getByRole('tab', { name: /Reviews/ }).click();
    const title = page.getByRole('link', { name: path.startsWith('/reviews/') ? 'Read review' : 'Space for thought', exact: true }).first();
    await expect(title).toHaveAttribute('href', path.startsWith('/reviews/') ? '/reviews/review-related' : '/reviews/review-one');
    await expect(page.getByRole('link', { name: 'Open Taylor Lane profile', exact: true }).first()).toHaveAttribute('href', '/users/reader-one');
    if (!path.startsWith('/reviews/')) {
      const reveal = page.getByRole('button', { name: 'Reveal spoiler', exact: true }).first();
      await reveal.click();
      if (path.startsWith('/book/')) {
        const richLink = page.getByRole('link', { name: 'Reading notes', exact: true }).first();
        await expect(richLink).toHaveAttribute('href', 'https://example.org/reading');
        expect(await richLink.evaluate(node => Boolean(node.parentElement?.closest('a,button')))).toBe(false);
      }
      await expect(page.getByRole('button', { name: 'Hide spoiler' }).first()).toBeVisible();
    }
    await expect(page.locator('a a, a button, button a')).toHaveCount(0);
    if (path === '/reviews') {
      await page.getByRole('button', { name: '2', exact: true }).first().click();
      expect(await page.evaluate(() => window.destinationActions)).toContain('review-like');
      await expect(page).toHaveURL(/\/reviews$/);
    }
    await title.click();
    await expect(page.getByRole('textbox', { name: 'Comment', exact: true })).toBeVisible();
  });
}

test('club previews do not gain links and membership actions do not navigate', async ({ page }) => {
  await ready(page, '/clubs');
  await expect(page.getByRole('link', { name: 'Open Reading Circle', exact: true })).toHaveAttribute('href', '/clubs/club-public');
  const preview = page.getByRole('heading', { name: 'Quiet Reading Circle', exact: true });
  await expect(preview).toBeVisible();
  await expect(page.locator('a[href="/clubs/club-private"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  expect(await page.evaluate(() => window.destinationActions)).toContain('join');
  await expect(page).toHaveURL(/\/clubs$/);
  await page.getByRole('button', { name: 'Request to Join', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Note for Quiet Reading Circle admins' })).toBeVisible();
  await expect(page.locator('a a, a button, button a')).toHaveCount(0);
});

test('Readers club tabs retain member and discovery destinations', async ({ page }) => {
  await ready(page, '/readers');
  await page.getByRole('tab', { name: 'Book Clubs', exact: true }).click();
  await expect(page.getByRole('link', { name: 'The Chapter Circle', exact: true })).toHaveAttribute('href', '/clubs/club-one');
  await expect(page.getByRole('link', { name: 'Private Members Circle', exact: true })).toHaveAttribute('href', '/clubs/club-private-member');
  await page.getByRole('tab', { name: /Discover/ }).click();
  await expect(page.getByRole('link', { name: 'Open Reading Circle', exact: true })).toHaveAttribute('href', '/clubs/club-public');
});

async function usable(link: Locator) {
  await link.scrollIntoViewIfNeeded();
  await expect.poll(() => link.evaluate(node => {
    const box = node.getBoundingClientRect();
    let top=0, left=0, right=innerWidth, bottom=innerHeight;
    for (let parent=node.parentElement; parent; parent=parent.parentElement) {
      const style=getComputedStyle(parent), rect=parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top=Math.max(top,rect.top); bottom=Math.min(bottom,rect.bottom); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left=Math.max(left,rect.left); right=Math.min(right,rect.right); }
    }
    return box.left>=left-1 && box.right<=right+1 && box.top>=top-1 && box.bottom<=bottom+1 &&
      [0.1,0.5,0.9].every(ratio=>{const hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height*ratio); return hit===node || node.contains(hit);});
  })).toBe(true);
}
for (const profile of [{name:'phone',width:390,height:844,text:100}, {name:'compact200',width:320,height:740,text:200},
  {name:'tablet200',width:834,height:1112,text:200}, {name:'desktop',width:1280,height:900,text:100},
  {name:'tabletDark',width:834,height:1112,text:100,theme:'dark'}]) {
  test(`Visual destinations ${profile.name}`, async ({ page }, info) => {
    await page.setViewportSize({width:profile.width,height:profile.height});
    for (const [path,name] of [['/readers','Taylor Lane'],['/clubs','Open Reading Circle'],['/reviews','Space for thought'],['/feed','A passage to return to']]) {
      await ready(page, `${path}?text=${profile.text}&theme=${profile.theme ?? 'light'}`);
      const link=page.getByRole('link',{name,exact:true}).first();
      await expect(link).toBeVisible();
      const fonts = await page.evaluate(async () => {
        await Promise.all(['Inter', 'Merriweather', 'Playfair Display'].map(font => document.fonts.load(`16px "${font}"`)));
        await document.fonts.ready;
        return ['Inter', 'Merriweather', 'Playfair Display'].map(family => ({ family,
          loaded: [...document.fonts].some(face => face.family.replace(/["']/g, '') === family && face.status === 'loaded') }));
      });
      for (const font of fonts) expect(font.loaded, `${font.family} loaded face`).toBe(true);
      await info.attach(`fonts-${path.slice(1)}`, { body: JSON.stringify(fonts), contentType: 'application/json' });
      await usable(link);
      await page.screenshot({path:info.outputPath(`${profile.name}-${path.slice(1)}.png`)});
      if (path !== '/clubs') {
        const author = page.getByRole('link', { name: 'Open Taylor Lane profile', exact: true }).first();
        await usable(author);
        const target = await author.boundingBox();
        expect(target!.height).toBeGreaterThanOrEqual(44);
        expect(target!.width).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: info.outputPath(`${profile.name}-${path.slice(1)}-author.png`) });
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  });
}
