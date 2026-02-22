import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('E2E: macro meter appears in Run2; bounded decision panel works', () => {
  beforeEach(async () => {
    // Navigate to the Run2 page
    await navigateToRun2();
  });

  it('should display the macro meter in Run2', async () => {
    const meterElement = await findElementByCssSelector('#run2-macro-meter');
    expect(meterElement).toBeVisible();
  });

  it('should display the bounded decision panel in Run2', async () => {
    const panelElement = await findElementByCssSelector('#run2-bounded-decision-panel');
    expect(panelElement).toBeVisible();
  });

  it('should handle empty data in the bounded decision panel', async () => {
    // Clear any existing data in the bounded decision panel
    await clearBoundedDecisionPanelData();

    const panelElement = await findElementByCssSelector('#run2-bounded-decision-panel');
    expect(panelElement).toBeVisible();
  });

  it('should handle maximum limit in the bounded decision panel', async () => {
    // Set maximum data in the bounded decision panel
    await setMaxBoundedDecisionPanelData();

    const panelElement = await findElementByCssSelector('#run2-bounded-decision-panel');
    expect(panelElement).toBeVisible();
  });

  it('should handle minimum limit in the bounded decision panel', async () => {
    // Set minimum data in the bounded decision panel
    await setMinBoundedDecisionPanelData();

    const panelElement = await findElementByCssSelector('#run2-bounded-decision-panel');
    expect(panelElement).toBeVisible();
  });

  afterEach(async () => {
    // Reset the application state to ensure tests are isolated
    await resetApplicationState();
  });
});
