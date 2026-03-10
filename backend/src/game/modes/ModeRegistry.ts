/*
 * POINT ZERO ONE — BACKEND MODES 15X GENERATOR
 * Generated at: 2026-03-10T01:26:02.003447+00:00
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 */

import type { ModeAdapter } from './contracts';
import { EmpireModeAdapter } from './adapters/EmpireModeAdapter';
import { PredatorModeAdapter } from './adapters/PredatorModeAdapter';
import { SyndicateModeAdapter } from './adapters/SyndicateModeAdapter';
import { PhantomModeAdapter } from './adapters/PhantomModeAdapter';

const REGISTRY: Record<'solo' | 'pvp' | 'coop' | 'ghost', ModeAdapter> = {
  solo: new EmpireModeAdapter(),
  pvp: new PredatorModeAdapter(),
  coop: new SyndicateModeAdapter(),
  ghost: new PhantomModeAdapter(),
};

export function getModeAdapter(mode: 'solo' | 'pvp' | 'coop' | 'ghost'): ModeAdapter {
  return REGISTRY[mode];
}

export function listModeAdapters(): ModeAdapter[] {
  return Object.values(REGISTRY);
}
