import { expect, test, type Page } from '@playwright/test';

const widths = [320, 390, 768, 834, 1024, 1440];
const surfaces = ['library', 'bookshelf', 'carousel', 'post', 'chart', 'messages'];

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

test.beforeEach(async ({ page }) => {
  // Fixtures must never read user records, contact analytics or authenticate.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' && url.port === '8084' ? route.continue() : route.abort();
  });
});

for (const width of widths) {
  for (const surface of surfaces) {
    test(`${surface} loading geometry and refresh at ${width}px`, async ({ page, browserName }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/?surface=${surface}&count=2&sidebar=${width >= 768 ? '1' : '0'}`);
      await expect(page.getByTestId('content')).toHaveAttribute('data-state', 'loading');
      await expect(page.getByRole('status')).toHaveText('Loading reading content');
      await settle(page);
      const before = await page.getByTestId('next-section').boundingBox();
      const busyBefore = await page.locator('[aria-busy]').boundingBox();
      expect(before).not.toBeNull();
      const placeholders = page.getByTestId('content').locator('[data-skeleton]');
      expect(await placeholders.count()).toBeGreaterThan(0);
      expect(await page.getByTestId('content').getByRole('button').count()).toBe(0);
      expect(await page.getByTestId('content').locator('input').count()).toBe(0);

      // No simulated click: CLS must not be hidden by the 500ms recent-input exclusion.
      await page.evaluate(() => {
        window.loadingMetrics = { cls: 0, shifts: 0, longTasks: 0, maxLongTask: 0 };
        window.loadingFixture.setState('ready');
      });
      await expect(page.getByTestId('content')).toHaveAttribute('data-state', 'ready');
      await settle(page);
      const after = await page.getByTestId('next-section').boundingBox();
      const busyAfter = await page.locator('[aria-busy]').boundingBox();
      expect(busyAfter!.x).toBeCloseTo(busyBefore!.x, 0);
      expect(busyAfter!.width).toBeCloseTo(busyBefore!.width, 0);
      // Variable text is a bounded estimate, not fabricated content. Chart and
      // conversation frames have a strict geometry contract; text cards allow
      // one short text line per visible row of first-load content.
      const tolerance = surface === 'chart' || surface === 'messages' ? 2 : 48;
      expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(tolerance);
      const metrics = await page.evaluate(() => window.loadingMetrics);
      if (browserName === 'chromium') expect(metrics.cls).toBeLessThanOrEqual(0.1);
      await testInfo.attach('loading-layout-metrics', { body: JSON.stringify({ width, surface, delta: after!.y - before!.y, ...metrics }), contentType: 'application/json' });

      const input = surface === 'messages' ? page.getByPlaceholder('Search messages') : page.getByTestId('filter');
      const filterValue = surface === 'messages' ? 'Reader' : 'Poetry';
      await input.fill(filterValue);
      await input.focus();
      await page.evaluate(() => window.scrollTo(0, 180));
      const scroll = await page.evaluate(() => window.scrollY);
      const retainedNodes = await page.locator('[aria-busy]').evaluateHandle((node) => {
        node.setAttribute('data-persistent-node', 'yes');
        return [node, ...node.querySelectorAll('*')];
      });
      await page.evaluate(() => window.loadingFixture.setState('refreshing'));
      await expect(page.locator('[data-refresh-indicator]')).toHaveText('Updating…');
      // DndKit may update transition styles without replacing any content.
      // Verify actual element identity, not a brittle HTML serialization.
      expect(await retainedNodes.evaluate((nodes) => nodes.every((node) => node.isConnected))).toBe(true);
      await expect(page.getByTestId('content').locator('.brack-skeleton')).toHaveCount(0);
      await retainedNodes.dispose();
      await expect(input).toHaveValue(filterValue);
      await expect(input).toBeFocused();
      await expect(page.locator('[data-persistent-node]')).toHaveAttribute('aria-busy', 'true');
      expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
      await page.evaluate(() => window.loadingFixture.setState('ready'));
      await expect(page.locator('[data-refresh-indicator]')).toHaveCount(0);
    });
  }
}

test('every registered theme in light/dark stays visible, inert and motion-free', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?surface=gallery');
  await expect(page.locator('[data-skeleton="library-flat"]')).toBeVisible();
  const themes = await page.evaluate(() => window.loadingFixture.themes);
  expect(themes).toContain('amoled-black');
  expect(themes).toContain('high-contrast');
  for (const id of themes) {
    for (const dark of [false, true]) {
      await page.evaluate(({ id, dark }) => window.loadingFixture.setTheme(id, dark), { id, dark });
      const facts = await page.locator('.brack-skeleton').first().evaluate((node) => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, animation: style.animationName, inert: node.hasAttribute('inert'), pointer: style.pointerEvents };
      });
      expect(facts.background, `${id}/${dark}`).not.toBe('rgba(0, 0, 0, 0)');
      expect(facts.animation).toBe('none');
      expect(facts.inert).toBe(true);
      expect(facts.pointer).toBe('none');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  expect(await page.locator('.brack-skeleton').first().evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  expect(await page.locator('.brack-skeleton').first().evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe('none');
  // No animation work exists to continue when offscreen or in a hidden tab.
  expect(await page.evaluate(() => [...document.querySelectorAll('.brack-skeleton')].reduce((count, node) => count + node.getAnimations().length, 0))).toBe(0);
});

test('empty, failure, retry and known-zero are not skeletons or misleading actions', async ({ page }) => {
  await page.goto('/?count=0');
  await expect(page.getByTestId('content')).toHaveAttribute('data-state', 'loading');
  await expect(page.getByTestId('content').locator('[data-skeleton]')).toHaveCount(0);
  await page.evaluate(() => window.loadingFixture.setState('empty'));
  await expect(page.getByText('No books yet. Add your first book.')).toBeVisible();
  await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(() => window.loadingFixture.setState('error'));
  await expect(page.getByRole('alert')).toHaveText('Reading content could not load.');
  await expect(page.getByText('No books yet. Add your first book.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('content')).toHaveAttribute('data-state', 'loading');
});

for (const count of [1, 4, 8]) {
  test(`long-content library layout respects container for ${count} books`, async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1000 });
    await page.goto(`/?surface=library&sidebar=1&long=1&count=${count}`);
    await expect(page.locator('[data-skeleton="book-card"]')).toHaveCount(count);
    await page.evaluate(() => window.loadingFixture.setState('ready'));
    await expect(page.locator('[data-slot]')).toHaveCount(count);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const content = await page.getByTestId('content').boundingBox();
    for (const item of await page.locator('[data-slot]').all()) {
      const bounds = await item.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(content!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(content!.x + content!.width + 1);
    }
  });
}
