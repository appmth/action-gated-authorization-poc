import { test, expect } from '@playwright/test';

test.describe('Judgment Detail Page', () => {
  test('navigating from activity shows detail with 4 sections', async ({ page }) => {
    await page.goto('/activity');
    // Click the first table row to navigate to detail
    await page.locator('tbody.group.cursor-pointer').first().click();
    await expect(page).toHaveURL(/.*\/judgments\/.+/);

    // Overview section with Decision badge
    await expect(page.getByText(/DENY|ALLOW/).first()).toBeVisible();

    // Reason section
    await expect(page.getByRole('heading', { name: 'Reason' })).toBeVisible();

    // Policy section
    await expect(page.getByRole('heading', { name: 'Policy' })).toBeVisible();

    // Context section
    await expect(page.getByText('Context (sanitized)')).toBeVisible();
  });

  test('shows not found message for invalid id', async ({ page }) => {
    await page.goto('/judgments/invalid-id');
    await expect(page.getByText('Judgment not found')).toBeVisible();
  });

  test('Back to Activity Log link navigates correctly', async ({ page }) => {
    await page.goto('/activity');
    // Navigate to a detail page first
    await page.locator('tbody.group.cursor-pointer').first().click();
    await expect(page).toHaveURL(/.*\/judgments\/.+/);
    // Click back link
    await page.getByRole('link', { name: /Back to Activity Log/ }).click();
    await expect(page).toHaveURL(/.*\/activity/);
  });
});
