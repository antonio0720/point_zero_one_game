/**
 * M56Mechanics — Base class for M056 doctrine draft mechanics
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_server/src/multiplayer/mechanics/m056_mechanics.ts
 */

export abstract class M56Mechanics {
  /** Unique mechanic identifier */
  public readonly mechanicId: string = 'M056';

  /** Semver of the mechanic contract — bump when output schema changes */
  public readonly version: string = '1.0.0';

  /**
   * Returns bounded [0,1] output values representing mechanic signal strengths.
   * Concrete subclasses must implement deterministic derivation.
   */
  public abstract getOutput(): number[];

  /**
   * Returns a deterministic audit hash for this mechanic instance.
   * Used for replay verification and ledger event construction.
   */
  public abstract getAuditHash(): string;

  /**
   * Validates that all output values are within [0, 1].
   * Call after getOutput() in test suites.
   */
  public validateOutputs(): boolean {
    return this.getOutput().every(v => typeof v === 'number' && v >= 0 && v <= 1);
  }
}
