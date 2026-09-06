/**
 * Basemap failure handling on the routed map (/community/map).
 *
 * Regression cover for a defect found in review: Leaflet's `load` event means
 * the visible tile batch has *settled*, not that it succeeded. `GridLayer.
 * _tileReady` records an errored tile as finished and fires `load` once nothing
 * is pending, so clearing the failure state on `load` hid the "Map background
 * unavailable" panel even when every tile had failed, leaving a blank map with
 * no explanation and no way out.
 *
 * These tests fail the tile requests for real — the requests are aborted at the
 * network layer and Leaflet's own machinery produces the events — rather than
 * emitting a hand-written event sequence at the component.
 */
import { test, expect, type Page } from '@playwright/test';

const LEGAL_CONSENT = JSON.stringify({
  termsVersion: '1.1.0',
  privacyVersion: '1.0.0',
  consentedAt: new Date().toISOString(),
});

/** Every basemap provider the build can serve. */
const TILE_URLS = '**/*{arcgisonline,cartocdn}*/**';
/** Esri satellite: the style the build opens on when no CARTO key is set. */
const SATELLITE_URLS = '**/*arcgisonline*/**';

// The route renders SimpleMapView twice — a mobile instance and a desktop one,
// only one of which is on screen at a given width — so every assertion targets
// the visible instance rather than whichever comes first in the DOM.
const PANEL = '[data-testid="map-unavailable"]:visible';
const RETRY = '[data-testid="map-unavailable-retry"]:visible';
const ACTIVITY = '[data-testid="map-unavailable-activity"]:visible';
const LOADED_TILE = '.leaflet-tile-loaded:visible';

/** The panel on screen, if any. */
const panelOf = (page: Page) => page.locator(PANEL).first();

/**
 * How long to let Leaflet finish a batch. The defect showed up precisely here:
 * the panel appeared while tiles were failing and then disappeared when the
 * batch settled, so every assertion that it is *still* visible has to come
 * after the batch has had time to complete.
 */
const BATCH_SETTLE_MS = 3000;

async function signIn(page: Page, request: Page['request']) {
  const seeded = await request.post('/api/e2e/seed-user', {
    data: { verified: true },
  });
  expect(seeded.ok()).toBeTruthy();
  const { credentials } = await seeded.json();

  await page.goto('/');
  await page.evaluate((consent) => {
    localStorage.setItem('nabornet_legal_consent', consent);
  }, LEGAL_CONSENT);

  await page.goto('/login');
  await page.fill('input[name="email"]', credentials.email);
  await page.fill('input[name="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/community/dashboard', { timeout: 15000 });
}

test.describe('Basemap failure handling', () => {
  test.beforeEach(async ({ request }) => {
    await request.delete('/api/e2e/cleanup');
  });

  test.afterEach(async ({ request }) => {
    await request.delete('/api/e2e/cleanup');
  });

  test('every tile failing keeps the notice up, with a way out', async ({ page, request }) => {
    await signIn(page, request);

    let tileRequests = 0;
    await page.route(TILE_URLS, (route) => {
      tileRequests += 1;
      return route.abort('failed');
    });

    await page.goto('/community/map');
    await expect(panelOf(page)).toBeVisible({ timeout: 20000 });

    // The regression: after the batch settles, `load` fires even though every
    // tile in it failed. The notice must survive that.
    await page.waitForTimeout(BATCH_SETTLE_MS);
    expect(tileRequests).toBeGreaterThan(0);
    await expect(panelOf(page)).toBeVisible();

    // The route out of a broken map must still work.
    await expect(page.locator(ACTIVITY).first()).toBeEnabled();
    await page.locator(ACTIVITY).first().click();
    await expect(page).toHaveURL(/\/community\/feed/);
  });

  test('retrying while the provider is still down keeps reporting the failure', async ({
    page,
    request,
  }) => {
    await signIn(page, request);
    await page.route(TILE_URLS, (route) => route.abort('failed'));

    await page.goto('/community/map');
    await expect(panelOf(page)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(BATCH_SETTLE_MS);

    await page.locator(RETRY).first().click();
    await page.waitForTimeout(BATCH_SETTLE_MS);
    await expect(panelOf(page)).toBeVisible();
  });

  test('the notice clears when a retry actually succeeds', async ({ page, request }) => {
    await signIn(page, request);

    let failTiles = true;
    await page.route(TILE_URLS, (route) =>
      failTiles ? route.abort('failed') : route.continue(),
    );

    await page.goto('/community/map');
    await expect(panelOf(page)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(BATCH_SETTLE_MS);

    failTiles = false;
    await page.locator(RETRY).first().click();
    await expect(page.locator(PANEL)).toHaveCount(0, { timeout: 20000 });

    // A real basemap is on screen, not just an absent notice.
    const tiles = page.locator(LOADED_TILE);
    await expect(tiles.first()).toBeVisible({ timeout: 20000 });
  });

  test('an isolated dropped tile does not block a usable map', async ({ page, request }) => {
    await signIn(page, request);

    let cartoRequests = 0;
    await page.route('**/*cartocdn*/**', (route) => {
      cartoRequests += 1;
      return route.continue();
    });

    let dropped = 0;
    await page.route(SATELLITE_URLS, (route) => {
      // Fail exactly one tile; serve the rest.
      if (dropped === 0) {
        dropped += 1;
        return route.abort('failed');
      }
      return route.continue();
    });

    await page.goto('/community/map');
    await page.waitForTimeout(BATCH_SETTLE_MS);
    // Only meaningful in the release configuration, where no CARTO key is set
    // and Esri satellite is the single available style.
    test.skip(
      cartoRequests > 0,
      'a CARTO key is configured, so the map does not open on satellite',
    );

    await expect(page.locator(LOADED_TILE).first()).toBeVisible({ timeout: 20000 });
    expect(dropped).toBe(1);
    await expect(page.locator(PANEL)).toHaveCount(0);
  });

  /**
   * Switching styles must not carry the failed style's health across.
   *
   * This needs more than one style to be available, which means a CARTO key
   * must be present in the dev server's build environment. Run with an
   * *invalid* key to make the CARTO styles fail for real while Esri satellite
   * keeps working:
   *
   *   VITE_CARTO_API_KEY=not-a-real-key E2E_TEST_MODE=true npm run dev
   *   npx playwright test e2e/map-basemap-failure.spec.ts
   *
   * Skipped otherwise, because with no key the build offers satellite only and
   * the panel has no style to switch to.
   */
  test('switching to a working style does not inherit the failed style state', async ({
    page,
    request,
  }) => {
    await signIn(page, request);

    await page.route('**/*cartocdn*/**', (route) => route.abort('failed'));
    await page.goto('/community/map');

    const switchToSatellite = page
      .locator('[data-testid="map-unavailable-switch-satellite"]:visible')
      .first();
    const panelAppeared = await panelOf(page)
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    test.skip(
      !panelAppeared || !(await switchToSatellite.count()),
      'needs VITE_CARTO_API_KEY set in the dev server build environment',
    );

    await page.waitForTimeout(BATCH_SETTLE_MS);
    await expect(panelOf(page)).toBeVisible();

    await switchToSatellite.click();
    await expect(page.locator(PANEL)).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator(LOADED_TILE).first()).toBeVisible({ timeout: 20000 });
  });
});
