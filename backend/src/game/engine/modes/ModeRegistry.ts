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

import type { ModeCode } from '../core/GamePrimitives';
import type { ModeAdapter } from './ModeContracts';

export class ModeRegistry {
  private readonly adapters = new Map<ModeCode, ModeAdapter>();

  public register(adapter: ModeAdapter): void {
    this.adapters.set(adapter.modeCode, adapter);
  }

  public mustGet(modeCode: ModeCode): ModeAdapter {
    const adapter = this.adapters.get(modeCode);
    if (!adapter) {
      throw new Error(`Mode adapter missing: ${modeCode}`);
    }
    return adapter;
  }
}
