/**
 * MLContext — src/ml/wiring/MLContext.tsx
 * Point Zero One · Density6 LLC · Confidential
 *
 * Owns all ML engine instances for a run's lifetime.
 * Mount once at RunScreen level. Key on runId to reset on new run.
 *
 *   <MLProvider key={runId} mode={state.mode} sessionRunCount={n}>
 *     <RunScreen />
 *   </MLProvider>
 */

import React, {
  createContext, useContext, useRef,
  useState, useCallback, useMemo,
  type ReactNode,
} from 'react';

import {
  KnowledgeTracer,
  HaterBotController,
  computeIntelligence,
  type IntelligenceOutput,
  type RunSnapshot,
  type KnowledgeState,
  type TrainingRecommendation,
  type BotDecision,
  type PlayOutcome,
} from '../index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MLState {
  intel:            IntelligenceOutput;
  knowledgeStates:  KnowledgeState[];
  trainingPlan:     TrainingRecommendation[];
  lastBotDecision:  BotDecision | null;
  sessionRunCount:  number;
}

export interface MLActions {
  updateIntel:    (snap: RunSnapshot, tier: 1|2|3|4|5) => BotDecision | null;
  recordCardPlay: (outcome: PlayOutcome) => void;
  finalizeRun:    () => TrainingRecommendation[];
  resetForNewRun: () => void;
}

export interface MLContextValue {
  state:   MLState;
  actions: MLActions;
  engines: { tracer: KnowledgeTracer; botCtrl: HaterBotController };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_INTEL: IntelligenceOutput = {
  alpha: 0.5, risk: 0, volatility: 0, antiCheat: 1,
  personalization: 0.6, rewardFit: 0.5, recommendationPower: 0.3,
  churnRisk: 0, momentum: 0, biasScore: 0, convergenceSignal: 0.5,
  sessionMomentum: 0, bankruptcyRisk60: 0, windowFailRisk: 0,
  tiltRisk: 0, opportunityCostEst: 0,
};

const MLContext = createContext<MLContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface MLProviderProps {
  children:         ReactNode;
  mode:             string;
  sessionRunCount?: number;
}

export function MLProvider({ children, mode, sessionRunCount = 1 }: MLProviderProps) {
  const tracerRef = useRef(new KnowledgeTracer());
  const botRef    = useRef(new HaterBotController());

  const [intel, setIntel]                     = useState<IntelligenceOutput>(DEFAULT_INTEL);
  const [knowledgeStates, setKnowledgeStates] = useState<KnowledgeState[]>([]);
  const [trainingPlan, setTrainingPlan]       = useState<TrainingRecommendation[]>([]);
  const [lastBotDecision, setLastBotDecision] = useState<BotDecision | null>(null);

  const botActive = mode === 'EMPIRE' || mode === 'PREDATOR';

  const updateIntel = useCallback((
    snap: RunSnapshot,
    tier: 1|2|3|4|5,
  ): BotDecision | null => {
    const next = computeIntelligence(snap, [], sessionRunCount);
    setIntel(next);
    if (!botActive) return null;
    const decision = botRef.current.decide(next, snap.tick, tier);
    setLastBotDecision(decision);
    return decision;
  }, [botActive, sessionRunCount]);

  const recordCardPlay = useCallback((outcome: PlayOutcome) => {
    tracerRef.current.record(outcome);
    setKnowledgeStates(tracerRef.current.getAllStates());
  }, []);

  const finalizeRun = useCallback((): TrainingRecommendation[] => {
    const plan = tracerRef.current.getTrainingPlan();
    setTrainingPlan(plan);
    return plan;
  }, []);

  const resetForNewRun = useCallback(() => {
    tracerRef.current = new KnowledgeTracer();
    botRef.current    = new HaterBotController();
    setIntel(DEFAULT_INTEL);
    setKnowledgeStates([]);
    setTrainingPlan([]);
    setLastBotDecision(null);
  }, []);

  const state   = useMemo(() => ({ intel, knowledgeStates, trainingPlan, lastBotDecision, sessionRunCount }), [intel, knowledgeStates, trainingPlan, lastBotDecision, sessionRunCount]);
  const actions = useMemo(() => ({ updateIntel, recordCardPlay, finalizeRun, resetForNewRun }), [updateIntel, recordCardPlay, finalizeRun, resetForNewRun]);
  const engines = useMemo(() => ({ tracer: tracerRef.current, botCtrl: botRef.current }), []);

  return (
    <MLContext.Provider value={{ state, actions, engines }}>
      {children}
    </MLContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useML(): MLContextValue {
  const ctx = useContext(MLContext);
  if (!ctx) throw new Error('[useML] Must be inside <MLProvider>');
  return ctx;
}
export function useIntel():            IntelligenceOutput { return useML().state.intel; }
export function useKnowledgeStates():  KnowledgeState[]   { return useML().state.knowledgeStates; }
export function useLastBotDecision():  BotDecision | null  { return useML().state.lastBotDecision; }