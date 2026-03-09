/**
 * Query leaderboard with only verified runs.
 */
import { Leaderboard } from "../entities/Leaderboard";
import { Run } from "../entities/Run";
import { verifyRun } from "./run_verification";

/**
 * Fetches the competitive leaderboard with only verified runs.
 * Quarantined runs are automatically removed.
 */
export async function getCompetitiveLeaderboard(): Promise<Leaderboard[]> {
  // Fetch all runs from the database
  const runs: Run[] = await Run.find({ where: { isVerified: true } });

  // Verify each run and update its status if necessary
  for (const run of runs) {
    await verifyRun(run);
  }

  // Filter out quarantined runs and sort the remaining runs by score
  const competitiveLeaderboard = runs.filter((run) => !run.isQuarantined).sort((a, b) => b.score - a.score);

  return competitiveLeaderboard;
}
