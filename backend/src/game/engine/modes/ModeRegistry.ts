/*
 * POINT ZERO ONE — BACKEND ENGINE MODE REGISTRY
 * /backend/src/game/engine/modes/ModeRegistry.ts
 *
 * Doctrine:
 * - mode lookup must be deterministic
 * - default registry should be easy to construct
 * - adapters remain isolated and swappable
 */

import type { ModeCode } from '../core/GamePrimitives';
import type { ModeAdapter } from './ModeContracts';
import { EmpireModeAdapter } from './EmpireModeAdapter';
import { PredatorModeAdapter } from './PredatorModeAdapter';
import { SyndicateModeAdapter } from './SyndicateModeAdapter';
import { PhantomModeAdapter } from './PhantomModeAdapter';

export class ModeRegistry {
  private readonly adapters = new Map<ModeCode, ModeAdapter>();

  public register(adapter: ModeAdapter): this {
    this.adapters.set(adapter.modeCode, adapter);
    return this;
  }

  public registerMany(adapters: readonly ModeAdapter[]): this {
    for (const adapter of adapters) {
      this.register(adapter);
    }
    return this;
  }

  public has(modeCode: ModeCode): boolean {
    return this.adapters.has(modeCode);
  }

  public list(): readonly ModeAdapter[] {
    return [...this.adapters.values()];
  }

  public mustGet(modeCode: ModeCode): ModeAdapter {
    const adapter = this.adapters.get(modeCode);
    if (!adapter) {
      throw new Error(`Mode adapter missing: ${modeCode}`);
    }
    return adapter;
  }

  public static createDefault(): ModeRegistry {
    return new ModeRegistry().registerMany([
      new EmpireModeAdapter(),
      new PredatorModeAdapter(),
      new SyndicateModeAdapter(),
      new PhantomModeAdapter(),
    ]);
  }
}

export const DEFAULT_MODE_REGISTRY = ModeRegistry.createDefault();