import { test, expect } from '@playwright/test';

test.describe('LegalGate', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure fresh state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('nabornet_legal_consent');
    });
  });

  test('blocks app access until terms and privacy are accepted', async ({ page }) => {
    // Navigate to home with cleared consent
    await page.goto('/');
    
    // Verify legal gate is visible
    await expect(page.locator('[data-testid="legal-gate"]')).toBeVisible();
    
    // Verify "Welcome to NaborNet" heading is shown in LegalGate
    await expect(page.locator('text=Welcome to NaborNet')).toBeVisible();
    
    // Verify the important notice is displayed
    await expect(page.locator('text=not an emergency service')).toBeVisible();
    
    // Find the accept button - should be disabled without checkboxes
    const acceptButton = page.locator('[data-testid="btn-accept-legal"]');
    await expect(acceptButton).toBeVisible();
    
    // Verify button is disabled before checking boxes
    await expect(acceptButton).toBeDisabled();
    
    // Now check the terms checkbox
    const termsCheckbox = page.locator('[data-testid="terms-checkbox"]').or(
      page.locator('button[role="checkbox"]').first()
    );
    await termsCheckbox.click();
    
    // Check the privacy checkbox
    const privacyCheckbox = page.locator('[data-testid="privacy-checkbox"]').or(
      page.locator('button[role="checkbox"]').nth(1)
    );
    await privacyCheckbox.click();
    
    // Button should now be enabled
    await expect(acceptButton).toBeEnabled();
    
    // Now click accept
    await acceptButton.click();
    
    // Wait for legal gate to disappear
    await expect(page.locator('[data-testid="legal-gate"]')).not.toBeVisible({ timeout: 5000 });
    
    // Verify we're past the gate - the important notice should no longer be visible
    await expect(page.locator('text=not an emergency service')).not.toBeVisible();
  });

  test('persists consent across page reloads', async ({ page }) => {
    // Start fresh
    await page.goto('/');
    
    // Accept the terms
    await page.locator('button[role="checkbox"]').first().click();
    await page.locator('button[role="checkbox"]').nth(1).click();
    await page.locator('[data-testid="btn-accept-legal"]').click();
    
    // Wait for gate to close
    await expect(page.locator('[data-testid="legal-gate"]')).not.toBeVisible({ timeout: 5000 });
    
    // Reload the page
    await page.reload();
    
    // Legal gate should NOT appear again
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-testid="legal-gate"]')).not.toBeVisible();
  });
});
