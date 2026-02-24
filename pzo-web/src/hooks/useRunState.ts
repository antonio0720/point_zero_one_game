/**
 * PZO UPGRADE — src/hooks/useRunState.ts
 * Central run state manager for all new slices.
 * Import and call inside App.tsx to get full state.
 * 
 * Usage in App.tsx:
 * 
 *   const runState = useRunState();
 *   // Pass runState.balanceSheet, runState.obligations, etc. to resolver
 *   // Call runState.applyResolutionResult(result) after resolveCardEffects()
 */

import { useState, useCallback } from 'react';
import type {
  BalanceSheet,
  ObligationRecord,
  PortfolioRecord,
  MitigationRecord,
  MindState,
  ReputationState,
  CapabilityState,
  PendingMaturity,
  DifficultyProfile,
  BiasState,
  CapabilityStat,
  ZoneId,
  AssetClass,
} from '../types/game';

import {
  DIFFICULTY_PROFILES,
  computeReputationTier,
  isInDistress,
} from '../types/game';

import type { ResolutionResult, RecoveryAction } from '../engine/resolver';
import {
  computeReputationTier as computeTier,
  getRecoveryActions,
  updateHubrisMeter,
  tickObligations,
} from '../engine/resolver';

// Re-export for convenience
export type { ZoneId } from '../types/game';

// ─── Initial State Factories ─────────────────────────────────────────────────

function makeDefaultBalanceSheet(startingCash: number): BalanceSheet {
  return {
    cash: startingCash,
    reserves: 0,
    illiquidValue: 0,
    monthlyObligations: 0,
    obligationCoverage: 1.0,
  };
}

function makeDefaultMindState(): MindState {
  return {
    activeBiases: {},
    hubrisMeter: 0,
    disciplineScore: 50,
  };
}

function makeDefaultReputation(): ReputationState {
  return {
    score: 0,
    tier: 'Unknown',
    recentEvents: [],
  };
}

function makeDefaultCapabilities(): CapabilityState {
  return {
    underwriting: 0,
    negotiation: 0,
    bookkeeping: 0,
    marketing: 0,
    compliance: 0,
    analytics: 0,
    systems: 0,
  };
}

// ─── Run State Shape ─────────────────────────────────────────────────────────

export interface RunStateSlices {
  balanceSheet: BalanceSheet;
  obligations: ObligationRecord[];
  portfolio: PortfolioRecord[];
  mitigations: MitigationRecord[];
  mindState: MindState;
  reputation: ReputationState;
  capabilities: CapabilityState;
  pendingMaturities: PendingMaturity[];
  difficultyProfile: DifficultyProfile;
  wasEverInDistress: boolean;
  isInDistressNow: boolean;
  availableRecoveryActions: RecoveryAction[];
}

export interface RunStateActions {
  setDifficulty: (preset: DifficultyProfile['preset']) => void;
  applyResolutionResult: (
    result: ResolutionResult,
    card: { id: string; assetClass?: AssetClass | null; cashflowMonthly?: number | null; zone?: ZoneId; value?: number | null; energyCost?: number },
    currentTick: number,
  ) => string[]; // returns log messages
  tickMonth: (income: number, currentTick: number) => string[];
  checkMaturities: (currentTick: number) => PendingMaturity[];
  applyRecoveryAction: (action: RecoveryAction) => string[];
  resetRunState: (startingCash: number) => void;
  addMitigation: (mit: MitigationRecord) => void;
  consumeMitigation: (type: string, amount: number) => void;
  setReserves: (amount: number) => void;
  incrementCapability: (stat: CapabilityStat, amount: number) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRunState(startingCash = 28_000): RunStateSlices & RunStateActions {
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet>(() => makeDefaultBalanceSheet(startingCash));
  const [obligations, setObligations] = useState<ObligationRecord[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioRecord[]>([]);
  const [mitigations, setMitigations] = useState<MitigationRecord[]>([]);
  const [mindState, setMindState] = useState<MindState>(makeDefaultMindState);
  const [reputation, setReputation] = useState<ReputationState>(makeDefaultReputation);
  const [capabilities, setCapabilities] = useState<CapabilityState>(makeDefaultCapabilities);
  const [pendingMaturities, setPendingMaturities] = useState<PendingMaturity[]>([]);
  const [difficultyProfile, setDifficultyProfileState] = useState<DifficultyProfile>(DIFFICULTY_PROFILES.STANDARD);
  const [wasEverInDistress, setWasEverInDistress] = useState(false);

  // Derived
  const isInDistressNow = isInDistress(balanceSheet, balanceSheet.cash, difficultyProfile);
  const availableRecoveryActions = isInDistressNow
    ? getRecoveryActions(balanceSheet.cash, portfolio, obligations)
    : [];

  // ── Actions ────────────────────────────────────────────────────────────────

  const setDifficulty = useCallback((preset: DifficultyProfile['preset']) => {
    setDifficultyProfileState(DIFFICULTY_PROFILES[preset]);
  }, []);

  const applyResolutionResult = useCallback((
    result: ResolutionResult,
    card: { id: string; assetClass?: AssetClass | null; cashflowMonthly?: number | null; zone?: ZoneId; value?: number | null; energyCost?: number },
    currentTick: number,
  ): string[] => {
    const logs: string[] = [];

    // Cash
    setBalanceSheet(prev => ({
      ...prev,
      cash: prev.cash + result.cashDelta - (card.energyCost ?? 0),
      illiquidValue: prev.illiquidValue + Math.max(0, result.netWorthDelta),
      monthlyObligations: prev.monthlyObligations + (result.obligationAdded?.amountPerMonth ?? 0),
    }));

    // Portfolio
    if (card.assetClass && result.netWorthDelta > 0) {
      const newAsset: PortfolioRecord = {
        cardId: card.id,
        cardName: card.id,
        assetClass: card.assetClass,
        value: Math.max(0, result.netWorthDelta + (card.value ?? 0)),
        monthlyIncome: card.cashflowMonthly ?? 0,
        purchaseTick: currentTick,
        zone: card.zone ?? 'BUILD',
        terms: null,
      };
      setPortfolio(prev => [...prev, newAsset]);
      logs.push(`Portfolio: +${card.assetClass} asset`);
    }

    // Obligations
    if (result.obligationAdded) {
      setObligations(prev => [...prev, result.obligationAdded!]);
      logs.push(`Obligation added: ${result.obligationAdded.label}`);
    }

    // Maturity
    if (result.maturityQueued) {
      setPendingMaturities(prev => [...prev, result.maturityQueued!]);
      logs.push(`Queued maturity: ${result.maturityQueued.label}`);
    }

    // Shield consumed
    if (result.shieldConsumed) {
      logs.push('Shield absorbed damage');
    }

    // Bias state
    if (result.biasStateSet) {
      setMindState(prev => ({
        ...prev,
        activeBiases: {
          ...prev.activeBiases,
          [result.biasStateSet!]: { expiresAtTick: currentTick + 72, intensity: 0.8 },
        },
      }));
      logs.push(`Bias: ${result.biasStateSet} activated`);
    }
    if (result.biasStateCleared) {
      setMindState(prev => {
        const next = { ...prev, activeBiases: { ...prev.activeBiases } };
        delete next.activeBiases[result.biasStateCleared as BiasState];
        next.disciplineScore = Math.min(100, next.disciplineScore + 5);
        return next;
      });
      logs.push(`Bias cleared: +5 discipline`);
    }

    // Capability
    if (result.capabilityGained) {
      const { stat, amount } = result.capabilityGained;
      setCapabilities(prev => ({
        ...prev,
        [stat]: Math.min(10, (prev[stat] ?? 0) + amount),
      }));
      logs.push(`Capability: +${amount} ${stat}`);
    }

    // Reputation
    if (result.reputationDelta !== 0) {
      setReputation(prev => {
        const newScore = Math.max(0, Math.min(1000, prev.score + result.reputationDelta));
        return {
          ...prev,
          score: newScore,
          tier: computeTier(newScore),
          recentEvents: [`${result.reputationDelta > 0 ? '+' : ''}${result.reputationDelta} rep`, ...prev.recentEvents].slice(0, 10),
        };
      });
    }

    // Hubris update
    setMindState(prev => ({
      ...prev,
      hubrisMeter: updateHubrisMeter(
        prev.hubrisMeter,
        0, // win streak passed from parent
        result.cashflowDelta,
        (card.energyCost ?? 0) > 15_000,
        balanceSheet.reserves < 500,
      ),
    }));

    // Distress check
    if (isInDistressNow) {
      setWasEverInDistress(true);
    }

    logs.push(result.explanation);
    return logs;
  }, [balanceSheet, isInDistressNow]);

  const tickMonth = useCallback((income: number, currentTick: number): string[] => {
    const logs: string[] = [];

    // Obligations tick
    const oblResult = tickObligations(obligations, income);
    logs.push(oblResult.explanation);

    // Decrement tick-based obligations
    setObligations(prev =>
      prev
        .map(o => o.ticksRemaining !== null ? { ...o, ticksRemaining: o.ticksRemaining - 12 } : o)
        .filter(o => o.ticksRemaining === null || o.ticksRemaining > 0)
    );

    // Update coverage ratio
    setBalanceSheet(prev => ({
      ...prev,
      obligationCoverage: oblResult.coverageRatio,
    }));

    // Expire stale biases
    setMindState(prev => {
      const next = { ...prev, activeBiases: { ...prev.activeBiases } };
      for (const [bias, state] of Object.entries(next.activeBiases) as [BiasState, { expiresAtTick: number }][]) {
        if (state.expiresAtTick <= currentTick) {
          delete next.activeBiases[bias];
          logs.push(`Bias ${bias} expired`);
        }
      }
      // Natural hubris decay
      next.hubrisMeter = Math.max(0, next.hubrisMeter - 2);
      return next;
    });

    if (oblResult.isUnderwater) {
      logs.push('⚠️ Obligations exceed income. Burning reserves.');
      setBalanceSheet(prev => ({
        ...prev,
        reserves: Math.max(0, prev.reserves - oblResult.totalDue + income),
      }));
    }

    return logs;
  }, [obligations]);

  const checkMaturities = useCallback((currentTick: number): PendingMaturity[] => {
    const ready = pendingMaturities.filter(m => m.matureAtTick <= currentTick);
    if (ready.length > 0) {
      setPendingMaturities(prev => prev.filter(m => m.matureAtTick > currentTick));
    }
    return ready;
  }, [pendingMaturities]);

  const applyRecoveryAction = useCallback((action: RecoveryAction): string[] => {
    setBalanceSheet(prev => ({
      ...prev,
      cash: prev.cash + action.cashDelta,
      illiquidValue: Math.max(0, prev.illiquidValue + action.netWorthDelta),
    }));

    if (action.cashflowDelta < 0) {
      // Obligation reduction (austerity/restructure)
      setObligations(prev => prev.map(o => ({
        ...o,
        amountPerMonth: Math.max(0, o.amountPerMonth - Math.abs(action.cashflowDelta) / Math.max(1, prev.length)),
      })));
    }

    setReputation(prev => {
      const newScore = Math.max(0, Math.min(1000, prev.score + action.reputationDelta));
      return {
        ...prev,
        score: newScore,
        tier: computeTier(newScore),
        recentEvents: [action.explanation, ...prev.recentEvents].slice(0, 10),
      };
    });

    if (action.id === 'SELL_ASSET') {
      setPortfolio(prev => prev.slice(1)); // remove lowest-performing
    }

    return [action.explanation];
  }, []);

  const resetRunState = useCallback((startCash: number) => {
    setBalanceSheet(makeDefaultBalanceSheet(startCash));
    setObligations([]);
    setPortfolio([]);
    setMitigations([]);
    setMindState(makeDefaultMindState());
    setReputation(makeDefaultReputation());
    setCapabilities(makeDefaultCapabilities());
    setPendingMaturities([]);
    setWasEverInDistress(false);
  }, []);

  const addMitigation = useCallback((mit: MitigationRecord) => {
    setMitigations(prev => [...prev, mit]);
  }, []);

  const consumeMitigation = useCallback((type: string, amount: number) => {
    setMitigations(prev =>
      prev
        .map(m => m.type === type
          ? { ...m, remainingAbsorption: Math.max(0, m.remainingAbsorption - amount) }
          : m
        )
        .filter(m => m.remainingAbsorption > 0)
    );
  }, []);

  const setReserves = useCallback((amount: number) => {
    setBalanceSheet(prev => ({
      ...prev,
      cash: prev.cash - amount,
      reserves: prev.reserves + amount,
    }));
  }, []);

  const incrementCapability = useCallback((stat: CapabilityStat, amount: number) => {
    setCapabilities(prev => ({
      ...prev,
      [stat]: Math.min(10, (prev[stat] ?? 0) + amount),
    }));
  }, []);

  return {
    balanceSheet,
    obligations,
    portfolio,
    mitigations,
    mindState,
    reputation,
    capabilities,
    pendingMaturities,
    difficultyProfile,
    wasEverInDistress,
    isInDistressNow,
    availableRecoveryActions,
    setDifficulty,
    applyResolutionResult,
    tickMonth,
    checkMaturities,
    applyRecoveryAction,
    resetRunState,
    addMitigation,
    consumeMitigation,
    setReserves,
    incrementCapability,
  };
}
