/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE STORE — MECHANICS SLICE
 * pzo-web/src/store/engineStore.mechanics-slice.ts
 *
 * Runtime observability slice for Phase 5/6 mechanic integration.
 * Tracks per-mechanic heat, activations, confidence, signal, and registration
 * metadata so React debug surfaces can inspect live mechanic behavior without
 * importing engine internals.
 *
 * DESIGN RULES:
 *   ✦ Pure store/runtime state only — no mechanic execution logic lives here.
 *   ✦ Safe to wire before MechanicsRouter is fully implemented; unknown mechanics
 *     are lazily synthesized when activation events arrive.
 *   ✦ All writes are atomic and draft-based through Zustand + immer.
 *
 * EVENTS CONSUMED (Phase 6):
 *   MECHANICS_RUNTIME_INITIALIZED
 *   MECHANICS_CATALOG_REGISTERED
 *   MECHANIC_ACTIVATED
 *   MECHANIC_CONFIDENCE_UPDATED
 *   MECHANIC_SIGNAL_UPDATED
 *   MECHANIC_HEAT_DECAYED
 *   MECHANICS_RUNTIME_RESET
 *
 * Density6 LLC · Point Zero One · Mechanics Runtime Slice · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { MechanicRecord } from '../data/mechanicsLoader';
import type { EventBus }       from '../engines/zero/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MechanicRuntimeEntry {
  mechanicId:       string;
  taskId:           string;
  title:            string;
  family:           string;
  kind:             'core' | 'ml';
  layer:            string;
  priority:         1 | 2 | 3;
  batch:            1 | 2 | 3;
  status:           string;
  deps:             string[];
  execHook:         string;
  telemetryEvents:  string[];

  heat:             number;
  activations:      number;
  confidence:       number;
  signal:           number;
  lastTick:         number | null;
  lastActivatedAt:  number | null;
}

export interface MechanicsRuntimeStoreSlice {
  runId:            string | null;
  isInitialized:    boolean;
  totalActivations: number;
  lastUpdatedTick:  number;
  hotMechanicIds:   string[];
  orderedIds:       string[];
  mechanicsById:    Record<string, MechanicRuntimeEntry>;
}

export interface MechanicActivationPayload {
  mechanicId:       string;
  tickIndex?:       number;
  signal?:          number;
  heatDelta?:       number;
  confidenceDelta?: number;
  family?:          string;
  title?:           string;
  kind?:            'core' | 'ml';
  layer?:           string;
  priority?:        1 | 2 | 3;
  batch?:           1 | 2 | 3;
  status?:          string;
  execHook?:        string;
}

export interface MechanicConfidencePayload {
  mechanicId:  string;
  confidence:  number;
  tickIndex?:  number;
}

export interface MechanicSignalPayload {
  mechanicId:  string;
  signal:      number;
  tickIndex?:  number;
}

export interface MechanicDecayPayload {
  mechanicId?: string;
  factor?:     number;
  amount?:     number;
  tickIndex?:  number;
}

export interface MechanicsRegistrationPayload {
  runId?:      string;
  mechanics?:  MechanicRecord[];
}

export type MechanicsSliceSet = (
  updater: (state: { mechanics: MechanicsRuntimeStoreSlice }) => void
) => void;

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS + HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const HOT_HEAT_THRESHOLD = 1.0;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createUnknownEntry(mechanicId: string): MechanicRuntimeEntry {
  return {
    mechanicId,
    taskId:          mechanicId,
    title:           mechanicId,
    family:          'unknown',
    kind:            'core',
    layer:           'tick_engine',
    priority:        3,
    batch:           3,
    status:          'runtime_only',
    deps:            [],
    execHook:        '',
    telemetryEvents: [],
    heat:            0,
    activations:     0,
    confidence:      0.10,
    signal:          0,
    lastTick:        null,
    lastActivatedAt: null,
  };
}

function entryFromRecord(record: MechanicRecord): MechanicRuntimeEntry {
  return {
    mechanicId:       record.mechanic_id,
    taskId:           record.task_id,
    title:            record.title,
    family:           record.family,
    kind:             record.kind,
    layer:            record.layer,
    priority:         record.priority,
    batch:            record.batch,
    status:           record.status,
    deps:             [...record.deps],
    execHook:         record.exec_hook,
    telemetryEvents:  [...record.telemetry_events],
    heat:             0,
    activations:      0,
    confidence:       record.status === 'done' ? 0.90 : 0.50,
    signal:           0,
    lastTick:         null,
    lastActivatedAt:  null,
  };
}

function recomputeHotIds(slice: MechanicsRuntimeStoreSlice): void {
  slice.hotMechanicIds = slice.orderedIds.filter(
    id => (slice.mechanicsById[id]?.heat ?? 0) >= HOT_HEAT_THRESHOLD,
  );
}

export function defaultMechanicsSlice(): MechanicsRuntimeStoreSlice {
  return {
    runId:            null,
    isInitialized:    false,
    totalActivations: 0,
    lastUpdatedTick:  0,
    hotMechanicIds:   [],
    orderedIds:       [],
    mechanicsById:    {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

export const mechanicsStoreHandlers = {
  reset(set: MechanicsSliceSet, runId: string | null = null): void {
    set((state) => {
      state.mechanics = {
        ...defaultMechanicsSlice(),
        runId,
      };
    });
  },

  registerCatalog(
    set: MechanicsSliceSet,
    mechanics: MechanicRecord[],
    runId: string | null = null,
  ): void {
    set((state) => {
      const next = defaultMechanicsSlice();
      next.runId         = runId;
      next.isInitialized = true;

      for (const record of mechanics) {
        next.mechanicsById[record.mechanic_id] = entryFromRecord(record);
      }

      next.orderedIds = mechanics
        .map((record) => record.mechanic_id)
        .sort((a, b) => {
          const left  = next.mechanicsById[a];
          const right = next.mechanicsById[b];
          const keyL  = left.priority * 10 + left.batch;
          const keyR  = right.priority * 10 + right.batch;
          return keyL - keyR || a.localeCompare(b);
        });

      recomputeHotIds(next);
      state.mechanics = next;
    });
  },

  recordActivation(set: MechanicsSliceSet, payload: MechanicActivationPayload): void {
    set((state) => {
      const entry =
        state.mechanics.mechanicsById[payload.mechanicId] ??
        (state.mechanics.mechanicsById[payload.mechanicId] = createUnknownEntry(payload.mechanicId));

      if (!state.mechanics.orderedIds.includes(payload.mechanicId)) {
        state.mechanics.orderedIds = [...state.mechanics.orderedIds, payload.mechanicId];
      }

      if (payload.family   !== undefined) entry.family   = payload.family;
      if (payload.title    !== undefined) entry.title    = payload.title;
      if (payload.kind     !== undefined) entry.kind     = payload.kind;
      if (payload.layer    !== undefined) entry.layer    = payload.layer;
      if (payload.priority !== undefined) entry.priority = payload.priority;
      if (payload.batch    !== undefined) entry.batch    = payload.batch;
      if (payload.status   !== undefined) entry.status   = payload.status;
      if (payload.execHook !== undefined) entry.execHook = payload.execHook;

      entry.activations     += 1;
      entry.lastTick         = payload.tickIndex ?? state.mechanics.lastUpdatedTick;
      entry.lastActivatedAt  = Date.now();
      entry.heat             = clamp(
        entry.heat + (payload.heatDelta ?? 0.12) + Math.abs(payload.signal ?? 0) * 0.25,
        0,
        5,
      );
      entry.signal           = clamp(entry.signal + (payload.signal ?? 0), -3, 3);
      entry.confidence       = clamp(
        entry.confidence + (payload.confidenceDelta ?? 0.015) + Math.abs(payload.signal ?? 0) * 0.02,
        0.08,
        0.99,
      );

      state.mechanics.isInitialized    = true;
      state.mechanics.totalActivations += 1;
      state.mechanics.lastUpdatedTick   = payload.tickIndex ?? state.mechanics.lastUpdatedTick;
      recomputeHotIds(state.mechanics);
    });
  },

  updateConfidence(set: MechanicsSliceSet, payload: MechanicConfidencePayload): void {
    set((state) => {
      const entry =
        state.mechanics.mechanicsById[payload.mechanicId] ??
        (state.mechanics.mechanicsById[payload.mechanicId] = createUnknownEntry(payload.mechanicId));

      entry.confidence = clamp(payload.confidence, 0.08, 0.99);
      entry.lastTick   = payload.tickIndex ?? state.mechanics.lastUpdatedTick;

      if (!state.mechanics.orderedIds.includes(payload.mechanicId)) {
        state.mechanics.orderedIds = [...state.mechanics.orderedIds, payload.mechanicId];
      }

      state.mechanics.isInitialized  = true;
      state.mechanics.lastUpdatedTick = payload.tickIndex ?? state.mechanics.lastUpdatedTick;
      recomputeHotIds(state.mechanics);
    });
  },

  updateSignal(set: MechanicsSliceSet, payload: MechanicSignalPayload): void {
    set((state) => {
      const entry =
        state.mechanics.mechanicsById[payload.mechanicId] ??
        (state.mechanics.mechanicsById[payload.mechanicId] = createUnknownEntry(payload.mechanicId));

      entry.signal   = clamp(payload.signal, -3, 3);
      entry.lastTick = payload.tickIndex ?? state.mechanics.lastUpdatedTick;

      if (!state.mechanics.orderedIds.includes(payload.mechanicId)) {
        state.mechanics.orderedIds = [...state.mechanics.orderedIds, payload.mechanicId];
      }

      state.mechanics.isInitialized  = true;
      state.mechanics.lastUpdatedTick = payload.tickIndex ?? state.mechanics.lastUpdatedTick;
      recomputeHotIds(state.mechanics);
    });
  },

  decayHeat(set: MechanicsSliceSet, payload: MechanicDecayPayload = {}): void {
    set((state) => {
      const factor = payload.factor ?? 0.94;
      const amount = payload.amount ?? 0.04;

      const decayEntry = (entry: MechanicRuntimeEntry): void => {
        entry.heat = clamp(entry.heat * factor - amount, 0, 5);
      };

      if (payload.mechanicId) {
        const entry = state.mechanics.mechanicsById[payload.mechanicId];
        if (entry) decayEntry(entry);
      } else {
        for (const id of state.mechanics.orderedIds) {
          const entry = state.mechanics.mechanicsById[id];
          if (entry) decayEntry(entry);
        }
      }

      state.mechanics.lastUpdatedTick = payload.tickIndex ?? state.mechanics.lastUpdatedTick;
      recomputeHotIds(state.mechanics);
    });
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// EVENT BUS WIRING
// ─────────────────────────────────────────────────────────────────────────────

export function wireMechanicsRuntimeHandlers(
  eventBus: EventBus,
  set: MechanicsSliceSet,
): void {
  eventBus.on('MECHANICS_RUNTIME_INITIALIZED' as any, (e: any) => {
    const payload = (e?.payload ?? e) as MechanicsRegistrationPayload;
    mechanicsStoreHandlers.registerCatalog(set, payload.mechanics ?? [], payload.runId ?? null);
  });

  eventBus.on('MECHANICS_CATALOG_REGISTERED' as any, (e: any) => {
    const payload = (e?.payload ?? e) as MechanicsRegistrationPayload;
    mechanicsStoreHandlers.registerCatalog(set, payload.mechanics ?? [], payload.runId ?? null);
  });

  eventBus.on('MECHANIC_ACTIVATED' as any, (e: any) => {
    mechanicsStoreHandlers.recordActivation(set, (e?.payload ?? e) as MechanicActivationPayload);
  });

  eventBus.on('MECHANIC_CONFIDENCE_UPDATED' as any, (e: any) => {
    mechanicsStoreHandlers.updateConfidence(set, (e?.payload ?? e) as MechanicConfidencePayload);
  });

  eventBus.on('MECHANIC_SIGNAL_UPDATED' as any, (e: any) => {
    mechanicsStoreHandlers.updateSignal(set, (e?.payload ?? e) as MechanicSignalPayload);
  });

  eventBus.on('MECHANIC_HEAT_DECAYED' as any, (e: any) => {
    mechanicsStoreHandlers.decayHeat(set, (e?.payload ?? e) as MechanicDecayPayload);
  });

  eventBus.on('MECHANICS_RUNTIME_RESET' as any, (e: any) => {
    const payload = (e?.payload ?? e) as { runId?: string | null } | undefined;
    mechanicsStoreHandlers.reset(set, payload?.runId ?? null);
  });
}
