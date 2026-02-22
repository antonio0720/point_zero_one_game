import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('E2E: die→loss package→fork practice→training scenario→next run start', () => {
  let initialBalance;

  beforeEach(async () => {
    // Initialize game state with initial balance
    initialBalance = await getInitialBalance();
  });

  afterEach(async () => {
    // Reset game state for next test
    await resetGameState();
  });

  it('happy path', async () => {
    // Simulate user dying and purchasing loss package
    const deathEvent = await simulateDeath();
    const lossPackagePurchase = await purchaseLossPackage(deathEvent);

    // Simulate forking practice and starting training scenario
    const forkedPractice = await forkPractice();
    const trainingScenarioStart = await startTrainingScenario(forkedPractice);

    // Check that the next run starts with the correct balance (initialBalance - loss package cost)
    expect(await getCurrentBalance()).toEqual(initialBalance - lossPackagePurchase.cost);
  });

  it('edge case: insufficient funds', async () => {
    // Set initial balance to be less than the cost of a loss package
    initialBalance = initialBalance - 1;

    // Simulate user dying and attempting to purchase loss package
    const deathEvent = await simulateDeath();
    const lossPackagePurchaseResult = await purchaseLossPackage(deathEvent);

    // Check that the purchase fails due to insufficient funds
    expect(lossPackagePurchaseResult.success).toBeFalsy();
  });

  it('boundary condition: maximum loss package limit reached', async () => {
    // Set initial balance to be greater than or equal to the cost of multiple loss packages
    const maxLossPackages = Math.floor(initialBalance / LossPackage.cost);

    // Simulate purchasing the maximum number of loss packages
    for (let i = 0; i < maxLossPackages; i++) {
      const deathEvent = await simulateDeath();
      const lossPackagePurchaseResult = await purchaseLossPackage(deathEvent);
    }

    // Simulate user dying and attempting to purchase another loss package
    const deathEvent = await simulateDeath();
    const lossPackagePurchaseResult = await purchaseLossPackage(deathEvent);

    // Check that the purchase fails due to reaching the maximum limit
    expect(lossPackagePurchaseResult.success).toBeFalsy();
  });
});
