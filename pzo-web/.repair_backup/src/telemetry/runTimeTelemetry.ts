// pzo-web/src/telemetry/runTimeTelemetry.ts
import { RunTimeSnapshot } from "./RunTimeSnapshot"; // Assuming this is the correct import path for your snapshot class or interface
import TimeEngine, { TickBudget, TierAtEnd } from "../timeEngine"; // Adjust based on actual location of these types/interfaces in your project structure.

export const captureRunTimeSnapshot = async (runId: string, engine: TimeEngine): Promise<RunTimeSnapshot> => {
  try {
    console.log(`Capturing snapshot for run ${runId}`); // Replace with actual analytics endpoint logging if required and ANALYTICS_ENDPOINT is set in the environment variables.
    
    const start = Date.now();
    let ticksElapsed: number;
    let tickBudget: TickBudget;
    let tierAtEnd: TierAtEnd | null; // Assuming this can be `null` if not determined at end of run yet, or a specific value/enum type as per your game logic.
    
    const snapshot = await engine.tick(async () => {}); // Replace with actual ticking mechanism that returns the number of ticks elapsed and budget remaining for this particular snapshots's duration (12 minutes).
    ticksElapsed = snapshot.ticksElapsed;
    tickBudget = snapshot.tickBudget;
    
    // Assuming we can determine tierAtEnd after the run, or it remains constant throughout:
    if (!tierAtEnd) {
      await engine.waitUntilTiersDetermined(); // This is a hypothetical function to wait for tiers determination at end of game (if needed).
      tierAtEnd = snapshot.determineFinalTier(runId); // Replace with actual logic or method call that returns the final TierAtEnd based on run data and decisions made during runtime.
    } else {
      console.log(`The player ended in Tier ${tierAtEnd}`);
    }
    
    const avgTickDurationMs = (Date.now() - start) / ticksElapsed; // Average tick duration calculation, assuming we have at least one elapsed tick for a non-zero division result.
    
    return {
      runId: runId,
      ticksElapsed,
      tickBudget,
      tierAtEnd,
      avgTickDurationMs, // Average duration in milliseconds of each game 'tick' (assuming a constant or predictable number of decisions per tick).
      decisionsExpiredTotal: snapshot.decisionsExpiredCount || 0, // Replace with actual count if available from the engine/game state; default to zero otherwise.
      decisionsResolvedTotal: snapshot.decisionsResolvedCount || 0, // Same as above for resolved counts.
      holdUsed: snapshot.holdUsedTicks || 0, // Assuming this is a property on your tick snapshots that tracks the use of holds during runtime; default to zero if not available or applicable in game logic.
    };
    
  } catch (error) {
    console.error(`Failed to capture run time telemetry snapshot: ${error}`);
    throw error; // Rethrowing errors ensures that calling code can handle them appropriately, e.g., logging or retry mechanisms if needed in a production environment.
 0-minute gameplay experience and the player's ability to make decisions within each tick is not affected by this telemetry capture process as it operates independently of the main game loop (async/fire-and-forget). The engine will continue running normally, unaffected by these non-blocking operations.
