import { test, expect } from '@playwright/test';

test.describe('Activity Log Page (formerly Judgment Map)', () => {
  test('redirects from root to /activity', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/activity/);
  });

  test('/map redirects to /activity', async ({ page }) => {
    await page.goto('/map');
    await expect(page).toHaveURL(/.*\/activity/);
  });

  test('displays page title', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
  });

  test('sidebar shows Activity Log label', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.getByRole('link', { name: 'Activity Log' })).toBeVisible();
  });

  test('displays table with correct columns (no Reason column header)', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.getByRole('columnheader', { name: 'Time' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Agent' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tool' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Decision' })).toBeVisible();
    // Reason column header was removed; reason is now displayed as a second row
    await expect(page.getByRole('columnheader', { name: 'Reason' })).not.toBeVisible();
  });

  test('shows both ALLOW and DENY decisions', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.getByText('ALLOW').first()).toBeVisible();
    await expect(page.getByText('DENY').first()).toBeVisible();
  });

  test('reason text is displayed below each row', async ({ page }) => {
    await page.goto('/activity');
    // Reason text appears in a second <tr> with colSpan=5, as inline text under each judgment
    // Check that at least one reason text line exists (a td spanning all columns)
    const reasonRows = page.locator('tbody tr td[colspan="5"]');
    await expect(reasonRows.first()).toBeVisible();
  });

  test('DENY rows have red background highlight', async ({ page }) => {
    await page.goto('/activity');
    // DENY rows get bg-red-50 class
    const denyRow = page.locator('tr.bg-red-50').first();
    await expect(denyRow).toBeVisible();
  });

  test('row click navigates to judgment detail', async ({ page }) => {
    await page.goto('/activity');
    // Click the first table row (tbody with cursor-pointer) to navigate
    await page.locator('tbody.group.cursor-pointer').first().click();
    await expect(page).toHaveURL(/.*\/judgments\/.+/);
  });

  test('agent dropdown has All Agents option and tiles show deny rate', async ({ page }) => {
    await page.goto('/activity');
    // Custom dropdown button shows "All Agents" text when no agent selected
    const dropdown = page.locator('[data-testid="agent-dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText('All Agents');
    // Click to open dropdown and verify "All Agents" option exists
    await dropdown.locator('button').click();
    await expect(dropdown.getByText('All Agents').first()).toBeVisible();
    // Close dropdown by clicking button again
    await dropdown.locator('button').click();
    // At least one agent tile shows "Deny Rate:"
    await expect(page.getByText(/Deny Rate:/).first()).toBeVisible();
  });

  test('agent tile click sets aria-selected and selection styling', async ({ page }) => {
    await page.goto('/activity');
    // Click a specific agent tile
    const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
    await agentTile.click();
    // Selection uses aria-selected, gray background, shadow
    await expect(agentTile).toHaveAttribute('aria-selected', 'true');
    await expect(agentTile).toHaveClass(/bg-gray-50/);
    await expect(agentTile).toHaveClass(/shadow-md/);
    // Left indicator bar exists as child element (blue)
    const indicator = agentTile.locator('.bg-blue-500.rounded-l-md');
    await expect(indicator).toBeVisible();
    // Selected badge should be visible
    await expect(agentTile.locator('[data-testid="selected-badge"]')).toBeVisible();
  });

  test('agent tile selection preserves risk border', async ({ page }) => {
    await page.goto('/activity');
    // Find a high-risk agent tile (border-red-400) if one exists
    const highRiskTile = page.locator('.min-w-\\[270px\\][aria-selected].border-red-400');
    const highRiskCount = await highRiskTile.count();
    if (highRiskCount > 0) {
      // Click the high-risk tile to select it
      await highRiskTile.first().click();
      // After selection, the tile should still have the red risk border
      await expect(highRiskTile.first()).toHaveClass(/border-red-400/);
      // And have blue left indicator bar as child element
      const indicator = highRiskTile.first().locator('.bg-blue-500.rounded-l-md');
      await expect(indicator).toBeVisible();
      await expect(highRiskTile.first()).toHaveAttribute('aria-selected', 'true');
      // Selected badge should be visible
      await expect(highRiskTile.first().locator('[data-testid="selected-badge"]')).toBeVisible();
    } else {
      // Fallback: select any agent tile and verify selection indicator is present
      const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
      await agentTile.click();
      const indicator = agentTile.locator('.bg-blue-500.rounded-l-md');
      await expect(indicator).toBeVisible();
      await expect(agentTile).toHaveAttribute('aria-selected', 'true');
      await expect(agentTile.locator('[data-testid="selected-badge"]')).toBeVisible();
    }
  });
});

test.describe('Branding: TopBar', () => {
  test('TopBar shows brand block with Judgment and AI Governance Platform', async ({ page }) => {
    await page.goto('/activity');
    const topBar = page.locator('header');
    await expect(topBar.getByText('Judgment', { exact: true })).toBeVisible();
    await expect(topBar.getByText('AI Governance Platform')).toBeVisible();
  });

  test('TopBar shows project label', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.getByText('Project: Government AI Oversight')).toBeVisible();
  });
});

test.describe('Branding: Sidebar', () => {
  test('Sidebar does not show Action-Gated Authorization', async ({ page }) => {
    await page.goto('/activity');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Action-Gated Authorization')).not.toBeVisible();
  });

  test('Sidebar shows OVERVIEW section heading', async ({ page }) => {
    await page.goto('/activity');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Overview', { exact: false })).toBeVisible();
  });
});

test.describe('Branding: Favicon', () => {
  test('favicon link tag references judgment-ui-favicon', async ({ page }) => {
    await page.goto('/activity');
    // Next.js may inject multiple link[rel="icon"] tags; check that at least one has the SVG favicon
    const faviconSvg = page.locator('link[rel="icon"][href*="judgment-ui-favicon"]');
    await expect(faviconSvg).toBeAttached();
  });
});

test.describe('Branding: Activity Log details', () => {
  test('Activity Log title shows AI Agent Activity Log', async ({ page }) => {
    await page.goto('/activity');
    // Main heading is "AI Agent Activity Log"
    await expect(page.getByRole('heading', { name: 'AI Agent Activity Log' })).toBeVisible();
  });

  test('Agent tiles show AI icon (SVG) instead of warning emoji', async ({ page }) => {
    await page.goto('/activity');
    // Each agent tile (min-w-[270px]) should contain an SVG icon for the AI robot
    // The AI icon SVG has class "w-4 h-4 text-blue-500"
    const agentTiles = page.locator('.min-w-\\[270px\\]');
    // Wait for at least one agent tile to appear (count() doesn't auto-wait)
    await expect(agentTiles.first()).toBeVisible();
    const count = await agentTiles.count();
    expect(count).toBeGreaterThan(0);
    // First agent tile should have the AI robot SVG icon
    await expect(agentTiles.first().locator('svg.text-blue-500')).toBeVisible();
  });

  test('Agent tiles do not show warning emoji', async ({ page }) => {
    await page.goto('/activity');
    // The warning emoji should not appear in agent tiles
    const tiles = page.locator('.min-w-\\[270px\\]');
    const count = await tiles.count();
    for (let i = 0; i < count; i++) {
      await expect(tiles.nth(i).getByText('\u26A0\uFE0F')).toHaveCount(0);
    }
  });

  test('Table rows use unified group hover for data and reason rows', async ({ page }) => {
    await page.goto('/activity');
    // Each judgment is wrapped in a <tbody class="group"> with two <tr> rows
    // Verify at least one tbody.group exists with group-hover classes on its rows
    const groupBodies = page.locator('tbody.group');
    await expect(groupBodies.first()).toBeVisible();
    // The first tbody should have exactly 2 rows (data + reason)
    const rows = groupBodies.first().locator('tr');
    await expect(rows).toHaveCount(2);
  });
});

test.describe('Activity Log Dashboard: Snapshot Summary', () => {
  test('snapshot-summary container is visible', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="snapshot-summary"]')).toBeVisible();
  });

  test('snapshot-total shows a number', async ({ page }) => {
    await page.goto('/activity');
    const totalCard = page.locator('[data-testid="snapshot-total"]');
    await expect(totalCard).toBeVisible();
    // The card should contain a numeric value (the bold text)
    await expect(totalCard.locator('.text-2xl')).toHaveText(/\d+/);
  });

  test('snapshot-deny-rate shows percentage', async ({ page }) => {
    await page.goto('/activity');
    const denyRateCard = page.locator('[data-testid="snapshot-deny-rate"]');
    await expect(denyRateCard).toBeVisible();
    // Should contain a "%" character
    await expect(denyRateCard).toContainText('%');
  });

  test('Last updated time is displayed', async ({ page }) => {
    await page.goto('/activity');
    // After data loads, "Last updated:" text should appear
    await expect(page.getByText('Last updated:')).toBeVisible();
  });
});

test.describe('Activity Log Dashboard: Decision Filter', () => {
  test('decision-filter is visible', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="decision-filter"]')).toBeVisible();
  });

  test('clicking Allow hides DENY rows', async ({ page }) => {
    await page.goto('/activity');
    // Click Allow filter
    await page.locator('[data-testid="decision-filter-allow"]').click();
    // Client-side filtering: ALLOW badges should appear
    const allowBadges = page.locator('table span:has-text("ALLOW")');
    await expect(allowBadges.first()).toBeVisible();
    // DENY badges should not be visible in the table
    const denyBadges = page.locator('table span:has-text("DENY")');
    await expect(denyBadges).toHaveCount(0);
  });

  test('clicking Deny hides ALLOW rows', async ({ page }) => {
    await page.goto('/activity');
    // Click Deny filter
    await page.locator('[data-testid="decision-filter-deny"]').click();
    // Client-side filtering: DENY badges should appear
    const denyBadges = page.locator('table span:has-text("DENY")');
    await expect(denyBadges.first()).toBeVisible();
    // ALLOW badges should not be visible in the table
    const allowBadges = page.locator('table span:has-text("ALLOW")');
    await expect(allowBadges).toHaveCount(0);
  });

  test('clicking All shows all rows again', async ({ page }) => {
    await page.goto('/activity');
    // First filter to Allow only
    await page.locator('[data-testid="decision-filter-allow"]').click();
    // Then click All
    await page.locator('[data-testid="decision-filter-all"]').click();
    // Wait for table to stabilize after URL sync
    await page.waitForSelector('table tbody', { state: 'attached' });
    // Both ALLOW and DENY should be visible
    await expect(page.locator('table span:has-text("ALLOW")').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('table span:has-text("DENY")').first()).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Activity Log Dashboard: Agent/Tool Dropdowns', () => {
  test('agent-dropdown is visible', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="agent-dropdown"]')).toBeVisible();
  });

  test('tool-dropdown is visible', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="tool-dropdown"]')).toBeVisible();
  });
});

test.describe('Activity Log Dashboard: High Risk Only', () => {
  test('high-risk-toggle is visible', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="high-risk-toggle"]')).toBeVisible();
  });
});

test.describe('Activity Log Dashboard: Refresh Button', () => {
  test('refresh-button is visible', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="refresh-button"]')).toBeVisible();
  });

  test('refresh-button click works without error', async ({ page }) => {
    await page.goto('/activity');
    const refreshBtn = page.locator('[data-testid="refresh-button"]');
    await refreshBtn.click();
    // After refresh, the page should still show Activity Log heading
    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
    // Snapshot summary should still be present
    await expect(page.locator('[data-testid="snapshot-summary"]')).toBeVisible();
  });
});

test.describe('Activity Log Dashboard: Live Mode', () => {
  test('live-mode-toggle is visible', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="live-mode-toggle"]')).toBeVisible();
  });
});

test.describe('Activity Log Dashboard: Table Sort', () => {
  test('sort-time header exists', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="sort-time"]')).toBeVisible();
  });

  test('sort-decision click changes sort indicator', async ({ page }) => {
    await page.goto('/activity');
    const sortDecision = page.locator('[data-testid="sort-decision"]');
    // Initial state: no sort indicator
    const initialText = await sortDecision.textContent();
    // Click once => ascending
    await sortDecision.click();
    const afterFirstClick = await sortDecision.textContent();
    // Should now contain an ascending indicator (triangle up)
    expect(afterFirstClick).toContain('\u25B2');
    // Click again => descending
    await sortDecision.click();
    const afterSecondClick = await sortDecision.textContent();
    expect(afterSecondClick).toContain('\u25BC');
  });
});

test.describe('Activity Log Dashboard: Export CSV', () => {
  test('export-csv button is visible', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="export-csv"]')).toBeVisible();
  });
});

test.describe('Activity Log: Section Headings', () => {
  test('Agents section heading is displayed', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible();
  });

  test('Recent Activity section heading is displayed', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
  });

  test('old Showing text is not displayed', async ({ page }) => {
    await page.goto('/activity');
    // The old "Showing:" text line has been removed
    await expect(page.getByText(/^Showing:/)).not.toBeVisible();
  });
});

test.describe('Activity Log: All Agents Button', () => {
  test('All Agents tile is always visible (before and after selection)', async ({ page }) => {
    await page.goto('/activity');
    const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
    await expect(agentTile).toBeVisible({ timeout: 15000 });
    const allAgentsTile = page.locator('[data-testid="clear-agent-filter"]');
    // Tile should be visible before any agent is selected
    await expect(allAgentsTile).toBeVisible();
    await expect(allAgentsTile).toContainText('All Agents');
    // Select an agent tile
    await agentTile.click();
    // Tile should still be visible after selection
    await expect(allAgentsTile).toBeVisible();
    await expect(allAgentsTile).toContainText('All Agents');
  });

  test('All Agents tile has active styling when no agent is selected', async ({ page }) => {
    await page.goto('/activity');
    const allAgentsTile = page.locator('[data-testid="clear-agent-filter"]');
    await expect(allAgentsTile).toBeVisible({ timeout: 15000 });
    // When no agent selected (showing all), tile should have blue highlight
    await expect(allAgentsTile).toHaveClass(/bg-blue-50/);
    await expect(allAgentsTile).toContainText('Showing All');
  });

  test('All Agents tile has inactive styling when an agent is selected', async ({ page }) => {
    await page.goto('/activity');
    const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
    await expect(agentTile).toBeVisible({ timeout: 15000 });
    await agentTile.click();
    const allAgentsTile = page.locator('[data-testid="clear-agent-filter"]');
    // When agent is selected, tile should have neutral white styling
    await expect(allAgentsTile).toHaveClass(/bg-white/);
  });

  test('All Agents button clears agent selection', async ({ page }) => {
    await page.goto('/activity');
    const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
    await expect(agentTile).toBeVisible({ timeout: 15000 });
    // Select an agent tile
    await agentTile.click();
    await expect(agentTile).toHaveAttribute('aria-selected', 'true');
    // Click the All Agents button
    await page.locator('[data-testid="clear-agent-filter"]').click();
    // Agent tile should no longer be selected
    await expect(agentTile).toHaveAttribute('aria-selected', 'false');
    // Button should still be visible (always visible now)
    await expect(page.locator('[data-testid="clear-agent-filter"]')).toBeVisible();
  });

  test('clicking All Agents when no agent selected has no adverse effect', async ({ page }) => {
    await page.goto('/activity');
    const allAgentsBtn = page.locator('[data-testid="clear-agent-filter"]');
    await expect(allAgentsBtn).toBeVisible({ timeout: 15000 });
    // Click button when no agent is selected
    await allAgentsBtn.click();
    // Page should remain functional - heading visible, no errors
    await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
    // No agent tile should be selected
    const selectedTiles = page.locator('.min-w-\\[270px\\][aria-selected="true"]');
    await expect(selectedTiles).toHaveCount(0);
  });
});

test.describe('Activity Log: Selected Badge', () => {
  test('selected tile shows Selected badge', async ({ page }) => {
    await page.goto('/activity');
    const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
    await expect(agentTile).toBeVisible({ timeout: 15000 });
    await agentTile.click();
    const badge = agentTile.locator('[data-testid="selected-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('Selected');
  });

  test('unselected tiles do not show Selected badge', async ({ page }) => {
    await page.goto('/activity');
    // Without selecting any tile, no Selected badge should be visible
    const badges = page.locator('[data-testid="selected-badge"]');
    await expect(badges).toHaveCount(0);
  });

  test('selected badge is positioned top-left with blue styling', async ({ page }) => {
    await page.goto('/activity');
    const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
    await expect(agentTile).toBeVisible({ timeout: 15000 });
    await agentTile.click();
    const badge = agentTile.locator('[data-testid="selected-badge"]');
    await expect(badge).toBeVisible();
    // Badge should have left positioning (left-5)
    await expect(badge).toHaveClass(/left-5/);
    // Badge should have blue styling
    await expect(badge).toHaveClass(/text-blue-700/);
    await expect(badge).toHaveClass(/bg-blue-100/);
    await expect(badge).toHaveClass(/border-blue-300/);
  });
});

test.describe('Activity Log: Filter Chips', () => {
  test('agent filter chip appears when agent is selected', async ({ page }) => {
    await page.goto('/activity');
    // Select an agent tile
    const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
    await expect(agentTile).toBeVisible({ timeout: 15000 });
    await agentTile.click();
    // Agent filter chip should appear
    const chip = page.locator('[data-testid="filter-chip-agent"]');
    await expect(chip).toBeVisible();
    // Chip should contain "Agent:" prefix
    await expect(chip).toContainText('Agent:');
  });

  test('agent filter chip dismiss clears agent selection', async ({ page }) => {
    await page.goto('/activity');
    // Wait for data to load (agent tiles require API data)
    const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
    await expect(agentTile).toBeVisible({ timeout: 15000 });
    await agentTile.click();
    // Click dismiss on agent chip
    const chip = page.locator('[data-testid="filter-chip-agent"]');
    await expect(chip).toBeVisible();
    await chip.locator('button').click();
    // Chip should disappear
    await expect(chip).not.toBeVisible();
    // Agent tile should be deselected
    await expect(agentTile).toHaveAttribute('aria-selected', 'false');
  });

  test('decision filter chip appears when decision filter is set', async ({ page }) => {
    await page.goto('/activity');
    await expect(page.locator('[data-testid="decision-filter-deny"]')).toBeVisible({ timeout: 15000 });
    // Set decision filter to DENY
    await page.locator('[data-testid="decision-filter-deny"]').click();
    // Decision chip should appear
    const chip = page.locator('[data-testid="filter-chip-decision"]');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('Decision: DENY');
  });

  test('no filter chips when no filters active', async ({ page }) => {
    await page.goto('/activity');
    // No filters active -> filter-chips container should not be visible
    await expect(page.locator('[data-testid="filter-chips"]')).not.toBeVisible();
  });
});

test.describe('Activity Log: Tile-Dropdown Sync', () => {
  test('selecting agent tile updates dropdown value', async ({ page }) => {
    await page.goto('/activity');
    // Click first agent tile
    const agentTile = page.locator('.min-w-\\[270px\\][aria-selected]').first();
    await expect(agentTile).toBeVisible({ timeout: 15000 });
    await agentTile.click();
    // Custom dropdown button text should now show the agent name (not "All Agents")
    const dropdown = page.locator('[data-testid="agent-dropdown"]');
    const buttonText = await dropdown.locator('button span').first().textContent();
    // Dropdown should no longer show "All Agents" since an agent is selected
    expect(buttonText).not.toBe('All Agents');
  });

  test('selecting agent from dropdown highlights tile', async ({ page }) => {
    await page.goto('/activity');
    const dropdown = page.locator('[data-testid="agent-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 15000 });
    // Open the custom dropdown
    await dropdown.locator('button').click();
    // Click the second item (first non-"All Agents" option)
    const options = dropdown.locator('div.absolute > div');
    const optionCount = await options.count();
    if (optionCount > 1) {
      // Click the second option (index 1, skipping "All Agents" at index 0)
      await options.nth(1).click();
      // Find the tile that matches this agent and verify it's selected
      const selectedTiles = page.locator('.min-w-\\[270px\\][aria-selected="true"]');
      await expect(selectedTiles).toHaveCount(1);
    }
  });
});
