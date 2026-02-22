import { describe, it, expect } from 'vitest';
import { DailyGauntletSeedRotatesAtMidnight } from './daily_gauntlet_seed_rotates_at_midnight';

describe('Daily gauntlet seed rotates at midnight', () => {
  const dailyGauntletSeedRotatesAtMidnight = new DailyGauntletSeedRotatesAtMidnight();

  it('should set a new daily seed when the cron job runs', async () => {
    // Set up initial state
    await dailyGauntletSeedRotatesAtMidnight.init();
    const initialSeed = dailyGauntletSeedRotatesAtMidnight.getDailySeed();

    // Run cron job to set new daily seed
    await dailyGauntletSeedRotatesAtMidnight.runCronJob();

    // Get new daily seed after cron job has run
    const newSeed = dailyGauntletSeedRotatesAtMidnight.getDailySeed();

    // Assert that the new seed is different from the initial seed
    expect(newSeed).not.toBe(initialSeed);
  });

  it('should display the same seed badge on the landing page for all players', async () => {
    // Set up initial state
    await dailyGauntletSeedRotatesAtMidnight.init();
    const initialSeed = dailyGauntletSeedRotatesAtMidnight.getDailySeed();

    // Run cron job to set new daily seed
    await dailyGauntletSeedRotatesAtMidnight.runCronJob();

    // Get new daily seed after cron job has run
    const newSeed = dailyGauntletSeedRotatesAtMidnight.getDailySeed();

    // Assert that the new seed is different from the initial seed
    expect(newSeed).not.toBe(initialSeed);

    // Simulate user landing on page with both seeds
    const landingPageWithInitialSeed = await dailyGauntletSeedRotatesAtMidnight.renderLandingPage(initialSeed);
    const landingPageWithNewSeed = await dailyGauntletSeedRotatesAtMidnight.renderLandingPage(newSeed);

    // Assert that the seed badge is displayed on both pages and has the same value
    expect(landingPageWithInitialSeed.seedBadge).toBe(landingPageWithNewSeed.seedBadge);
  });
});
