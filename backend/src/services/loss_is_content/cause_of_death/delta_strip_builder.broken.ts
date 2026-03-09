/**
 * Builds the last 3 deltas ledger strip and pins it to the turning point.
 */

import { Delta } from '../deltas';

export interface DeltaStrip {
  turn_point_id: number;
  deltas: Delta[];
}

/**
 * Builds a delta strip containing the last 3 deltas and pins it to the turning point.
 * @param deltas - An array of deltas in chronological order.
 * @param turning_point_id - The id of the turning point.
 */
export function buildDeltaStrip(deltas: Delta[], turning_point_id: number): DeltaStrip {
  const lastThreeDeltas = deltas.slice(-3);
  const deltaStrip: DeltaStrip = { turn_point_id: turning_point_id, deltas: lastThreeDeltas };
  return deltaStrip;
}
