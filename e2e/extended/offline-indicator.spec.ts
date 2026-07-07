import { test, expect } from '@playwright/test';

const LEGAL_CONSENT = JSON.stringify({
  termsVersion: "1.1.0",
  privacyVersion: "1.0.0",
  consentedAt: new Date().toISOString(),
});

test.describe('Offline Indicator', () => {
  test('shows offline indicator when network is disconnected', async ({ page, context }) => {
    // Set legal consent to bypass LegalGate
    await page.goto('/');
    await page.evaluate((consent) => {
      localStorage.setItem('nabornet_legal_consent', consent);
    }, LEGAL_CONSENT);
    
    // Reload to apply consent and wait for full load
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Capture initial state - should be online
    const initialOnlineState = await page.evaluate(() => navigator.onLine);
    expect(initialOnlineState).toBe(true);
    
    // Initially, offline indicator should NOT be visible
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).not.toBeVisible();
    
    // Go offline using Playwright's network emulation
    await context.setOffline(true);
    
    // Dispatch offline event to trigger React state update
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    // Wait for UI to update
    await page.waitForTimeout(500);
    
    // Verify offline indicator is now visible
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });
    
    // Check for expected offline indicator content
    const indicatorText = await offlineIndicator.textContent();
    expect(indicatorText?.toLowerCase()).toContain('offline');
    
    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });
    
    // Wait for UI to update
    await page.waitForTimeout(500);
    
    // Offline indicator should disappear
    await expect(offlineIndicator).not.toBeVisible({ timeout: 5000 });
  });

  test('app shell loads from service worker cache when offline', async ({ page, context }) => {
    // First, load the page while online to prime the service worker cache
    await page.goto('/');
    await page.evaluate((consent) => {
      localStorage.setItem('nabornet_legal_consent', consent);
    }, LEGAL_CONSENT);
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for service worker to be active
    await page.waitForTimeout(2000);
    
    // Verify service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
      }
      return false;
    });
    expect(swRegistered).toBe(true);
    
    // Note the page title while online
    const onlineTitle = await page.title();
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate to a cached page
    await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {
      // May throw if completely offline, but SW should intercept
    });
    
    // Wait for service worker to serve cached content
    await page.waitForTimeout(1000);
    
    // Verify something loaded from cache
    const offlineTitle = await page.title().catch(() => '');
    const bodyExists = await page.locator('body').count();
    
    // Go back online for cleanup
    await context.setOffline(false);
    
    // Assertions:
    // 1. Page should have a body (content loaded)
    expect(bodyExists).toBeGreaterThan(0);
    
    // 2. Title should match (same page served from cache)
    expect(offlineTitle).toBe(onlineTitle);
  });
});
