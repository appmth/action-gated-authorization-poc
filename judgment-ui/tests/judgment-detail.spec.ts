import { test, expect } from '@playwright/test';

test.describe('Judgment Detail Page', () => {
  test('shows not found message for invalid request_id', async ({ page }) => {
    await page.goto('http://localhost:3000/judgments/invalid-request-id');

    // エラーメッセージが表示されることを確認
    await expect(page.getByText('Judgment not found')).toBeVisible();
  });

  test('has back to dashboard link', async ({ page }) => {
    await page.goto('http://localhost:3000/judgments/test-id');

    // Back to Dashboard リンクが存在することを確認
    await expect(page.getByRole('link', { name: 'Back to Judgment Map' })).toBeVisible();
  });

  test('back to dashboard link navigates correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/judgments/test-id');

    // Back to Dashboard をクリック
    await page.getByRole('link', { name: 'Back to Judgment Map' }).click();

    // ダッシュボードに戻ることを確認
    await expect(page).toHaveURL(/.*\/dashboard/);
  });
});
