import { test, expect } from '@playwright/test';

const LEGAL_CONSENT = JSON.stringify({
  termsVersion: "1.1.0",
  privacyVersion: "1.0.0",
  consentedAt: new Date().toISOString(),
});

test.describe('Smoke Tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/NaborNet/);
  });

  test('login page is accessible', async ({ page }) => {
    // Set legal consent BEFORE navigating to login (LegalGate blocks all routes)
    await page.goto('/');
    await page.evaluate((consent) => {
      localStorage.setItem('nabornet_legal_consent', consent);
    }, LEGAL_CONSENT);
    
    await page.goto('/login');
    // Use data-testid for the submit button to be specific
    await expect(page.locator('[data-testid="button-sign-in"]')).toBeVisible();
  });
});
