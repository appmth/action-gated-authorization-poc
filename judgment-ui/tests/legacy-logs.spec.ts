import { test, expect } from '@playwright/test';

test.describe('Legacy Log View Page', () => {
  test('displays Execution Log title', async ({ page }) => {
    await page.goto('/legacy-logs');
    await expect(page.getByRole('heading', { name: 'Execution Log' })).toBeVisible();
  });

  test('displays table with Time / Tool / Status columns only', async ({ page }) => {
    await page.goto('/legacy-logs');
    await expect(page.getByRole('columnheader', { name: 'Time' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tool' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    // Agent Role / Reason / Decision columns should NOT exist
    await expect(page.getByRole('columnheader', { name: 'Agent Role' })).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Reason' })).not.toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Decision' })).not.toBeVisible();
  });

  test('all rows show success status', async ({ page }) => {
    await page.goto('/legacy-logs');
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(10);

    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).getByText('success')).toBeVisible();
    }
  });
});
