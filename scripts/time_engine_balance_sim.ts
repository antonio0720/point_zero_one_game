// scripts/time_engine_balance_sim.ts
import { TimeEngine, PressureTier, TickBudget } from './time_engine';
import { simulateRun, aggregateMetrics } from './simulation_utils';

// Define types for simulation results
interface TierDwellMetrics {
  tier: number;
  averageDwellTime: number;
  minDwellTime: number;
  maxDwellTime: number;
}

interface DecisionWindowMetrics {
  tier: number;
  averageDecisionWindow: number;
  timeoutFrequency: number;
}

interface RunDurationMetrics {
  runId: number;
  duration: number;
  tierSequence: number[];
}

// Synthetic pressure tier generator
function generateSyntheticPressureSequence(length: number = 100): PressureTier[] {
  const tiers: PressureTier[] = [];
  for (let i = 0; i < length; i++) {
    tiers.push({
      tier: i,
      pressure: Math.random() * 100, // Random pressure value
      duration: Math.random() * 1000 // Random duration in ms
    });
  }
  return tiers;
}

// Main simulation function
async function runBalanceSimulation(
  config: TickBudget,
  runs: number = 1000
): Promise<{ 
  tierDwell: TierDwellMetrics[];
  decisionWindows: DecisionWindowMetrics[];
  runDurations: RunDurationMetrics[];
}> {
  const results = {
    tierDwell: [],
    decisionWindows: [],
    runDurations: []
  };

  for (let runId = 0; runId < runs; runId++) {
    const tierSequence = generateSyntheticPressureSequence();
    const runMetrics = await simulateRun(tierSequence, config);
    
    // Aggregate tier dwell metrics
    for (const [tier, dwell] of Object.entries(runMetrics.tierDwell)) {
      const index = results.tierDwell.findIndex(m => m.tier === parseInt(tier));
      if (index === -1) {
        results.tierDwell.push({
          tier: parseInt(tier),
          averageDwellTime: dwell,
          minDwellTime: dwell,
          maxDwell,Time: dwell
        });
      } else {
        results.tierDwell[index].averageDwellTime = 
          (results.tierDwell[index].averageDwellTime + dwell) / 2;
        results.tierDwell[index].minDwellTime = Math.min(
          results.tierDwell[index].minDwellTime, dwell
        );
        results.tierDwell[index].maxDwellTime = Math.max(
          results.tierDwell[index].maxDwellTime, dwell
        );
      }
    }

    // Aggregate decision window metrics
    for (const [tier, window] of Object.entries(runMetrics.decisionWindows)) {
      const index = results.decisionWindows.findIndex(m => m.tier === parseInt(tier));
      if (index === -1) {
        results.decisionWindows.push({
          tier: parseInt(tier),
          averageDecisionWindow: window,
          timeoutFrequency: runMetrics.timeoutCount / tierSequence.length
        });
      } else {
        results.decisionWindows[index].averageDecisionWindow = 
          (results.decisionWindows[index].averageDecisionWindow + window) / 2;
        results.decisionWindows[index].timeoutFrequency = 
          (results.decisionWindows[index].timeoutFrequency * 
          results.decisionWindows[index].timeoutFrequency.length + 
          runMetrics.timeoutCount) / 
          (tierSequence.length * 2);
      }
    }

    // Record run duration
    results.runDurations.push({
      runId,
      duration: runMetrics.totalDuration,
      tierSequence: tierSequence.map(t => t.tier)
    });
  }

  return results;
}

// Export for use in other modules
export { runBalanceSimulation, generateSyntheticPressureSequence };
