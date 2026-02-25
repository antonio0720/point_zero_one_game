/**
 * Game Engine Boundary
 */

import { Seed, Ledger } from './game/state';
import { CreateRunRequest, SubmitTurnDecisionRequest, FinalizeRunRequest } from './api/requests';
import { ReplayRunResponse } from './api/responses';

/**
 * Create a new run with the given seed and ledger.
 * @param seed - The random seed for the game.
 * @param ledger - The initial state of the game.
 */
export function createRun(seed: Seed, ledger: Ledger): Promise<string> {
  // Implement deterministic game engine logic to generate a new run ID and update the state.
}

/**
 * Submit a turn decision for the given run ID.
 * @param runId - The ID of the run to submit a decision for.
 * @param request - The turn decision to be submitted.
 */
export function submitTurnDecision(runId: string, request: SubmitTurnDecisionRequest): Promise<void> {
  // Implement deterministic game engine logic to update the state based on the submitted decision.
}

/**
 * Finalize a run with the given run ID.
 * @param runId - The ID of the run to finalize.
 */
export function finalizeRun(runId: string): Promise<ReplayRunResponse> {
  // Implement deterministic game engine logic to finalize the state and generate the replay data.
}

/**
 * Replay a run with the given run ID.
 * @param runId - The ID of the run to replay.
 */
export function replayRun(runId: string): Promise<void> {
  // Implement deterministic game engine logic to replay the state from the given run ID.
}
