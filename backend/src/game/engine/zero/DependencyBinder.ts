// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/DependencyBinder.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/DependencyBinder.ts
 *
 * Doctrine:
 * - zero owns reader wiring between engines
 * - wiring is additive and duck-typed so repo-native engines can opt in without forced rewrites
 * - this file does not import peer engine classes; it binds contracts through method presence
 * - failure to bind a reader must be visible in the report, never silent
 */

import type { ZeroDependencyBindingReport } from './zero.types';

interface SupportsPressureReader {
  setPressureReader?(reader: unknown): void;
}

interface SupportsShieldReader {
  setShieldReader?(reader: unknown): void;
}

interface SupportsTensionReader {
  setTensionReader?(reader: unknown): void;
}

interface SupportsCascadeReader {
  setCascadeReader?(reader: unknown): void;
}

export interface ZeroDependencyBundle {
  readonly timeEngine: SupportsPressureReader;
  readonly pressureEngine: SupportsShieldReader & SupportsCascadeReader;
  readonly tensionEngine: unknown;
  readonly shieldEngine: SupportsTensionReader;
  readonly battleEngine: SupportsShieldReader & SupportsTensionReader;
  readonly cascadeEngine: unknown;
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function tryBind(
  binder: (() => void) | undefined,
  successNote: string,
  missNote: string,
  notes: string[],
): boolean {
  if (binder === undefined) {
    notes.push(missNote);
    return false;
  }

  binder();
  notes.push(successNote);
  return true;
}

export class DependencyBinder {
  public bind(bundle: ZeroDependencyBundle): ZeroDependencyBindingReport {
    const notes: string[] = [];

    const pressureReaderBound = tryBind(
      bundle.timeEngine.setPressureReader === undefined
        ? undefined
        : () => {
            bundle.timeEngine.setPressureReader?.(bundle.pressureEngine);
          },
      'Bound pressure reader into time engine.',
      'Time engine does not expose setPressureReader().',
      notes,
    );

    const shieldReaderBoundForPressure = tryBind(
      bundle.pressureEngine.setShieldReader === undefined
        ? undefined
        : () => {
            bundle.pressureEngine.setShieldReader?.(bundle.shieldEngine);
          },
      'Bound shield reader into pressure engine.',
      'Pressure engine does not expose setShieldReader().',
      notes,
    );

    const shieldReaderBoundForBattle = tryBind(
      bundle.battleEngine.setShieldReader === undefined
        ? undefined
        : () => {
            bundle.battleEngine.setShieldReader?.(bundle.shieldEngine);
          },
      'Bound shield reader into battle engine.',
      'Battle engine does not expose setShieldReader().',
      notes,
    );

    const tensionReaderBoundForShield = tryBind(
      bundle.shieldEngine.setTensionReader === undefined
        ? undefined
        : () => {
            bundle.shieldEngine.setTensionReader?.(bundle.tensionEngine);
          },
      'Bound tension reader into shield engine.',
      'Shield engine does not expose setTensionReader().',
      notes,
    );

    const tensionReaderBoundForBattle = tryBind(
      bundle.battleEngine.setTensionReader === undefined
        ? undefined
        : () => {
            bundle.battleEngine.setTensionReader?.(bundle.tensionEngine);
          },
      'Bound tension reader into battle engine.',
      'Battle engine does not expose setTensionReader().',
      notes,
    );

    const cascadeReaderBound = tryBind(
      bundle.pressureEngine.setCascadeReader === undefined
        ? undefined
        : () => {
            bundle.pressureEngine.setCascadeReader?.(bundle.cascadeEngine);
          },
      'Bound cascade reader into pressure engine.',
      'Pressure engine does not expose setCascadeReader().',
      notes,
    );

    return Object.freeze({
      pressureReaderBound,
      shieldReaderBound:
        shieldReaderBoundForPressure && shieldReaderBoundForBattle,
      tensionReaderBound:
        tensionReaderBoundForShield && tensionReaderBoundForBattle,
      cascadeReaderBound,
      notes: freezeArray(notes),
    });
  }
}