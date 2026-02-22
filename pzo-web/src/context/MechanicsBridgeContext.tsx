/// <reference types="vite/client" />
/**
 * MechanicsBridgeContext.tsx — Sprint 3A
 *
 * Thin bridge contract between App.tsx's live mechanic registry
 * and mechanics stubs. Exposes ONLY what mechanics need:
 *
 *   touchMechanic(id, signal?)   — fire a named mechanic
 *   touchFamily(family, signal?) — fire all mechanics in a family
 *   snap                         — minimal readonly runtime snapshot
 *   isMechanicActive(id)         — check if mechanic has been fired
 *   debugLog(msg)                — dev-only bridge logging
 *
 * Guard rails:
 *   - ID validation against live registry
 *   - Family validation
 *   - Safe no-op fallback (warn, never crash)
 *   - Payload normalization
 *   - Dev console logging with [MechanicsBridge] prefix
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
} from 'react';

// ─── Types (exported — mechanics stubs depend on these, not on React/App) ─────

export type MechanicFamily =
  | 'replay' | 'economy' | 'risk' | 'market' | 'cards'
  | 'progression' | 'social' | 'telemetry' | 'pvp'
  | 'season' | 'ai' | 'anti_cheat' | 'narrative' | 'ops' | 'unknown';

export type MechanicTriggerPayload = {
  signal?: number;       // 0–1 strength of trigger, default 0.12
  reason?: string;       // human-readable, for debug logging
};

export type RuntimeSnapshot = {
  tick: number;
  cash: number;
  regime: string;
  intelligence: {
    alpha: number;
    risk: number;
    volatility: number;
    momentum: number;
    churnRisk: number;
    recommendationPower: number;
  };
  season: {
    xp: number;
    passTier: number;
    dominionControl: number;
    winStreak: number;
  };
};

export interface MechanicsBridgeAPI {
  /** Fire a specific mechanic by ID. No-ops with warning if ID unknown. */
  touchMechanic: (id: string, payload?: MechanicTriggerPayload) => void;
  /** Fire all mechanics in a family. No-ops with warning if family invalid. */
  touchFamily: (family: MechanicFamily, payload?: MechanicTriggerPayload) => void;
  /** True if mechanic has been activated at least once this run. */
  isMechanicActive: (id: string) => boolean;
  /** Readonly snapshot of minimal runtime state. */
  snap: RuntimeSnapshot;
  /** Dev-only: emit a tagged console message from a mechanic stub. */
  debugLog: (mechanicId: string, msg: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const VALID_FAMILIES = new Set<MechanicFamily>([
  'replay', 'economy', 'risk', 'market', 'cards',
  'progression', 'social', 'telemetry', 'pvp',
  'season', 'ai', 'anti_cheat', 'narrative', 'ops', 'unknown',
]);

const NO_OP_BRIDGE: MechanicsBridgeAPI = {
  touchMechanic: () => {},
  touchFamily: () => {},
  isMechanicActive: () => false,
  snap: {
    tick: 0, cash: 0, regime: 'Stable',
    intelligence: { alpha: 0, risk: 0, volatility: 0, momentum: 0, churnRisk: 0, recommendationPower: 0 },
    season: { xp: 0, passTier: 1, dominionControl: 0, winStreak: 0 },
  },
  debugLog: () => {},
};

export const MechanicsBridgeContext = createContext<MechanicsBridgeAPI>(NO_OP_BRIDGE);

// ─── Provider Props ───────────────────────────────────────────────────────────

export interface MechanicsBridgeProviderProps {
  /** Set of valid mechanic IDs from live registry — used for validation */
  validIds: Set<string>;
  /** Runtime state from App.tsx */
  runtime: Record<string, { activations: number }>;
  /** App.tsx touchMechanic — already useCallback-wrapped */
  onTouchMechanic: (id: string, signal?: number) => void;
  /** App.tsx touchFamily — already useCallback-wrapped */
  onTouchFamily: (family: MechanicFamily, signal?: number) => void;
  /** Snapshot of minimal runtime values */
  snapshot: RuntimeSnapshot;
  children: React.ReactNode;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MechanicsBridgeProvider({
  validIds,
  runtime,
  onTouchMechanic,
  onTouchFamily,
  snapshot,
  children,
}: MechanicsBridgeProviderProps) {
  const DEV = import.meta.env.DEV;

  const touchMechanic = useCallback(
    (id: string, payload?: MechanicTriggerPayload) => {
      const normalId = id.toUpperCase();
      if (!validIds.has(normalId)) {
        if (DEV) console.warn(`[MechanicsBridge] invalid mechanic: "${id}" — not in registry`);
        return;
      }
      const signal = Math.min(Math.max(payload?.signal ?? 0.12, 0), 1);
      if (DEV && payload?.reason) {
        console.debug(`[MechanicsBridge] ${normalId} (signal=${signal.toFixed(2)}) — ${payload.reason}`);
      }
      onTouchMechanic(normalId, signal);
    },
    [validIds, onTouchMechanic, DEV],
  );

  const touchFamily = useCallback(
    (family: MechanicFamily, payload?: MechanicTriggerPayload) => {
      if (!VALID_FAMILIES.has(family)) {
        if (DEV) console.warn(`[MechanicsBridge] invalid family: "${family}"`);
        return;
      }
      const signal = Math.min(Math.max(payload?.signal ?? 0.10, 0), 1);
      onTouchFamily(family as MechanicFamily, signal);
    },
    [onTouchFamily, DEV],
  );

  const isMechanicActive = useCallback(
    (id: string) => (runtime[id.toUpperCase()]?.activations ?? 0) > 0,
    [runtime],
  );

  const debugLog = useCallback(
    (mechanicId: string, msg: string) => {
      if (DEV) console.debug(`[MechanicsBridge:${mechanicId}] ${msg}`);
    },
    [DEV],
  );

  const value = useMemo<MechanicsBridgeAPI>(
    () => ({ touchMechanic, touchFamily, isMechanicActive, snap: snapshot, debugLog }),
    [touchMechanic, touchFamily, isMechanicActive, snapshot, debugLog],
  );

  return (
    <MechanicsBridgeContext.Provider value={value}>
      {children}
    </MechanicsBridgeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Use inside any mechanic stub to access the bridge. */
export function useMechanicsBridge(): MechanicsBridgeAPI {
  return useContext(MechanicsBridgeContext);
}
