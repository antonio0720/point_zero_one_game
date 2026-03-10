/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

export class PressureDecayController {
  public apply(previousScore: number, nextScore: number): number {
    if (nextScore >= previousScore) {
      return nextScore;
    }
    return Math.max(nextScore, previousScore - 6);
  }
}
