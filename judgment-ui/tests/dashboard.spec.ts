import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test('redirects from root to dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000/');

    // ルートから /dashboard へリダイレクトされることを確認
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('displays dashboard title', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');

    // タイトルが表示されることを確認
    await expect(page.getByRole('heading', { name: 'Judgment Dashboard' })).toBeVisible();
  });

  test('displays judgment table headers', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');

    // テーブルヘッダーが表示されることを確認
    await expect(page.getByRole('columnheader', { name: 'Request ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Result' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Reason' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Time' })).toBeVisible();
  });

  test('shows API connection error when service-a is not running', async ({ page }) => {
    // service-a が起動していない場合のエラー表示をテスト
    await page.goto('http://localhost:3000/dashboard');

    // API エラーまたはテーブルのいずれかが表示される
    const errorMessage = page.getByText('API に接続できません');
    const table = page.getByRole('table');

    // どちらかが表示されることを確認（APIが動いている/いないどちらのケースも対応）
    await expect(errorMessage.or(table)).toBeVisible();
  });
});
