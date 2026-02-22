import { test, expect } from '@playwright/test';

test.describe('Governance Insights Page', () => {
  test('/graph redirects to /governance', async ({ page }) => {
    await page.goto('/graph');
    await expect(page).toHaveURL(/.*\/governance/);
  });

  test('displays page title', async ({ page }) => {
    await page.goto('/governance');
    await expect(page.getByRole('heading', { name: 'Governance Insights' })).toBeVisible();
  });

  test('sidebar shows Governance Insights label', async ({ page }) => {
    await page.goto('/governance');
    await expect(page.getByRole('link', { name: 'Governance Insights' })).toBeVisible();
  });

  test('displays SYSTEM STATUS section', async ({ page }) => {
    await page.goto('/governance');
    await expect(page.getByText('SYSTEM STATUS')).toBeVisible();
    // Data loads asynchronously; wait for skeleton to resolve
    await expect(page.getByText('Active Agents')).toBeVisible();
    await expect(page.getByText('Global Deny Rate')).toBeVisible();
  });

  test('displays OVERVIEW section with Decision Distribution', async ({ page }) => {
    await page.goto('/governance');
    // Use exact match to avoid sidebar "Overview" collision
    await expect(page.getByText('OVERVIEW', { exact: true })).toBeVisible();
    await expect(page.getByText('Decision Distribution')).toBeVisible();
  });

  test('displays Agent-wise Deny Rate chart', async ({ page }) => {
    await page.goto('/governance');
    await expect(page.getByText('Agent-wise Deny Rate')).toBeVisible();
  });
});

test.describe('Governance Insights: Agent Risk Heatmap', () => {
  test('BEHAVIOR section heading is visible', async ({ page }) => {
    await page.goto('/governance');
    await expect(page.getByText('BEHAVIOR')).toBeVisible();
  });

  test('card title "Agent Risk Heatmap" is visible', async ({ page }) => {
    await page.goto('/governance');
    await expect(page.getByText('Agent Risk Heatmap')).toBeVisible();
  });

  test('heatmap subtitle is visible', async ({ page }) => {
    await page.goto('/governance');
    await expect(page.getByText('Deny rate by agent and time bucket (Last 24h)')).toBeVisible();
  });

  test('heatmap grid container is visible', async ({ page }) => {
    await page.goto('/governance');
    const grid = page.locator('[data-testid="heatmap-grid"]');
    await expect(grid).toBeVisible();
  });

  test('at least one agent row exists in heatmap', async ({ page }) => {
    await page.goto('/governance');
    const grid = page.locator('[data-testid="heatmap-grid"]');
    // Each agent row is a child div with flex items-center inside the grid
    const agentRows = grid.locator('> div').nth(1); // First row after column labels
    await expect(agentRows).toBeVisible();
  });

  test('column labels exist (-24h and Now)', async ({ page }) => {
    await page.goto('/governance');
    const grid = page.locator('[data-testid="heatmap-grid"]');
    await expect(grid.getByText('-24h')).toBeVisible();
    await expect(grid.getByText('Now')).toBeVisible();
  });

  test('summary column shows Total, Deny, and Rate labels for agents', async ({ page }) => {
    await page.goto('/governance');
    // The right column shows Total, Deny, Rate, 5m as separate label + value
    await expect(page.getByText('Total').first()).toBeVisible();
    await expect(page.getByText('Deny').first()).toBeVisible();
    await expect(page.getByText('Rate').first()).toBeVisible();
  });

  test('warning bar visible when high-risk agents exist', async ({ page }) => {
    await page.goto('/governance');
    // Mock data includes cs-night at 85.7% deny rate, so warning should show
    const warning = page.locator('[data-testid="heatmap-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('High Risk Agents');
  });

  test('BAN badge visible for banned agents', async ({ page }) => {
    await page.goto('/governance');
    // Mock data includes cs-night with status "banned"; use exact match to avoid legend "Banned"
    await expect(page.getByText('BANNED', { exact: true })).toBeVisible();
  });

  test('legend shows color scale labels', async ({ page }) => {
    await page.goto('/governance');
    await expect(page.getByText('0-10%')).toBeVisible();
    await expect(page.getByText('10-30%')).toBeVisible();
    await expect(page.getByText('30-50%')).toBeVisible();
    await expect(page.getByText('50-70%')).toBeVisible();
    await expect(page.getByText('70-100%')).toBeVisible();
    await expect(page.getByText('N/A')).toBeVisible();
  });
});
