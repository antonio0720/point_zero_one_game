/**
 * FILE: pzo-web/src/features/run/hooks/useCascadeEngine.ts
 *
 * Master cascade hook. Exposes all cascade state and derived flags to React components.
 * All state is read from the Zustand store — zero direct engine access.
 *
 * Usage:
 *   const { hasCatastrophic, isInSpiral, isCashflowMomentum } = useCascadeEngine();
 *
 * Selector hooks (for components that need only one field — avoid full hook render):
 *   useHasCatastrophicChain()
 *   useCascadeQueueDepth()
 *   useActivePositiveCascades()
 *   useCascadeLatestChainStarted()
 *
 * Density6 LLC · Point Zero One · Engine 6 of 7 · Confidential
 */
import { useEngineStore }   from '../../../store/engineStore';
import {
  ChainId,
  CascadeSeverity,
  type CascadeSnapshot,
  type CascadeChainInstance,
  type ActivePositiveCascade,
  type CascadeChainStartedEvent,
  type CascadeLinkFiredEvent,
  type CascadeChainBrokenEvent,
  type CascadePositiveActivatedEvent,
  type NemesisBrokenEvent,
} from '../../../engines/cascade/types';

// ── Full Master Hook ──────────────────────────────────────────────────────────

export function useCascadeEngine() {
  const snapshot              = useEngineStore(s => s.cascade.snapshot);
  const activeNegativeChains  = useEngineStore(s => s.cascade.activeNegativeChains);
  const activePositiveCascades= useEngineStore(s => s.cascade.activePositiveCascades);
  const latestChainStarted    = useEngineStore(s => s.cascade.latestChainStarted);
  const latestLinkFired       = useEngineStore(s => s.cascade.latestLinkFired);
  const latestChainBroken     = useEngineStore(s => s.cascade.latestChainBroken);
  const latestPositiveActivated=useEngineStore(s => s.cascade.latestPositiveActivated);
  const lastCompletedChain    = useEngineStore(s => s.cascade.lastCompletedChain);
  const nemesisBrokenEvents   = useEngineStore(s => s.cascade.nemesisBrokenEvents);
  const totalLinksDefeated    = useEngineStore(s => s.cascade.totalLinksDefeated);
  const isRunActive           = useEngineStore(s => s.cascade.isRunActive);
  const tickNumber            = useEngineStore(s => s.cascade.tickNumber);

  // ── Derived boolean flags ──────────────────────────────────────────────────

  const hasCatastrophicChain = snapshot?.hasCatastrophicChain  ?? false;
  const hasSevereChain       = snapshot?.highestActiveSeverity === CascadeSeverity.SEVERE;
  const hasModerateChain     = snapshot?.highestActiveSeverity === CascadeSeverity.MODERATE;
  const queueDepth           = snapshot?.queueDepth  ?? 0;
  const positiveCount        = snapshot?.positiveCount ?? 0;

  // ── Positive cascade presence flags ───────────────────────────────────────
  // Direct isActive check — guards against paused states returning true

  const isCashflowMomentum = activePositiveCascades?.some(
    p => p.pchainId === ChainId.PCHAIN_SUSTAINED_CASHFLOW && p.isActive && !p.isPaused
  ) ?? false;

  const isFortified = activePositiveCascades?.some(
    p => p.pchainId === ChainId.PCHAIN_FORTIFIED_SHIELDS && p.isActive && !p.isPaused
  ) ?? false;

  const isStreakMastery = activePositiveCascades?.some(
    p => p.pchainId === ChainId.PCHAIN_STREAK_MASTERY && p.isActive && !p.isPaused
  ) ?? false;

  const isSovereignMode = activePositiveCascades?.some(
    p => p.pchainId === ChainId.PCHAIN_SOVEREIGN_APPROACH && p.isActive && !p.isPaused
  ) ?? false;

  const isFortifiedPaused = activePositiveCascades?.some(
    p => p.pchainId === ChainId.PCHAIN_FORTIFIED_SHIELDS && p.isPaused
  ) ?? false;

  const isSovereignPaused = activePositiveCascades?.some(
    p => p.pchainId === ChainId.PCHAIN_SOVEREIGN_APPROACH && p.isPaused
  ) ?? false;

  // ── Composite state flags ─────────────────────────────────────────────────

  const hasAnyActiveChain = queueDepth > 0;
  const hasAnyPositive    = positiveCount > 0;

  /** Spiral = 2+ simultaneous active chains. Indicates compound suppression state. */
  const isInSpiral        = queueDepth >= 2;

  /** Catastrophic spiral = 3+ active chains with at least one CATASTROPHIC. */
  const isCatastrophicSpiral = hasCatastrophicChain && queueDepth >= 3;

  /** Clean = zero active negative chains AND at least one active positive cascade. */
  const isClean           = queueDepth === 0 && positiveCount > 0;

  /** Total suppression = CATASTROPHIC chain active (Total Systemic Cascade). */
  const isTotalSuppression = hasCatastrophicChain;

  /** Mastery state = all three primary positive cascades simultaneously active. */
  const isMasteryState    = isCashflowMomentum && isFortified && isStreakMastery;

  // ── Nemesis tracking ──────────────────────────────────────────────────────

  const nemesisCount = nemesisBrokenEvents?.length ?? 0;
  const lastNemesisBroken = nemesisBrokenEvents?.[nemesisBrokenEvents.length - 1] ?? null;

  // ── Link defeat stats ─────────────────────────────────────────────────────

  const totalLinksScheduled = snapshot?.totalLinksScheduled ?? 0;
  const defeatRate = totalLinksScheduled > 0
    ? Math.round((totalLinksDefeated / totalLinksScheduled) * 100)
    : 0;

  return {
    // Raw snapshot
    snapshot,

    // Chain lists
    activeNegativeChains:  activeNegativeChains  ?? [],
    activePositiveCascades:activePositiveCascades ?? [],

    // Latest events (for animations and notifications)
    latestChainStarted,
    latestLinkFired,
    latestChainBroken,
    latestPositiveActivated,
    lastCompletedChain,

    // Nemesis tracking
    nemesisBrokenEvents:   nemesisBrokenEvents ?? [],
    nemesisCount,
    lastNemesisBroken,

    // Stats
    totalLinksDefeated,
    totalLinksScheduled,
    defeatRate,          // % of all scheduled links defeated via recovery

    // Counts
    queueDepth,
    positiveCount,

    // Negative chain severity flags
    hasCatastrophicChain,
    hasSevereChain,
    hasModerateChain,

    // Positive cascade active flags (excludes paused)
    isCashflowMomentum,
    isFortified,
    isStreakMastery,
    isSovereignMode,

    // Pause flags (show "almost there" UI state)
    isFortifiedPaused,
    isSovereignPaused,

    // Composite state flags
    hasAnyActiveChain,
    hasAnyPositive,
    isInSpiral,
    isCatastrophicSpiral,
    isClean,
    isTotalSuppression,
    isMasteryState,

    // Run meta
    isRunActive,
    tickNumber,
  };
}

// ── Selector Hooks (single-field — minimal re-render surface) ─────────────────

/** Returns true if CHAIN_FULL_CASCADE_BREACH is active. Drives total-suppression UI. */
export function useHasCatastrophicChain(): boolean {
  return useEngineStore(s => s.cascade.snapshot?.hasCatastrophicChain ?? false);
}

/** Returns the number of active negative chain instances. */
export function useCascadeQueueDepth(): number {
  return useEngineStore(s => s.cascade.snapshot?.queueDepth ?? 0);
}

/** Returns all active positive cascades for targeted display. */
export function useActivePositiveCascades(): ActivePositiveCascade[] {
  return useEngineStore(s => s.cascade.activePositiveCascades ?? []);
}

/** Returns the latest chain started event — drives chain-arrival animation. */
export function useCascadeLatestChainStarted(): CascadeChainStartedEvent | null {
  return useEngineStore(s => s.cascade.latestChainStarted ?? null);
}

/** Returns the latest link fired event — drives consequence flash animation. */
export function useCascadeLatestLinkFired(): CascadeLinkFiredEvent | null {
  return useEngineStore(s => s.cascade.latestLinkFired ?? null);
}

/** Returns the latest chain broken event — drives recovery success animation. */
export function useCascadeLatestChainBroken(): CascadeChainBrokenEvent | null {
  return useEngineStore(s => s.cascade.latestChainBroken ?? null);
}

/** Returns all NEMESIS_BROKEN events this run — drives nemesis achievement display. */
export function useNemesisBrokenEvents(): NemesisBrokenEvent[] {
  return useEngineStore(s => s.cascade.nemesisBrokenEvents ?? []);
}

/** Returns the full cascade snapshot — for components that need direct snapshot access. */
export function useCascadeSnapshot(): CascadeSnapshot | null {
  return useEngineStore(s => s.cascade.snapshot ?? null);
}