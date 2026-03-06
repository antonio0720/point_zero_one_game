// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT MANUALLY
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/types.ts — Shared domain types for all mechanics
//
// Design Laws:
//   ✦ Deterministic-by-seed
//   ✦ Server-verifiable via ledger/audit hashes
//   ✦ Bounded chaos (no unbounded growth types)
//   ✦ No pay-to-win schema leaks
//
// Notes:
// - Keep this file “boring”: pure types/interfaces only.
// - No imports from other modules (prevents circular deps across mechanics).
// - If you add a type, export it. Mechanics rely on named imports from './types'.

// ─────────────────────────────────────────────────────────────────────────────
// Core Primitives
// ─────────────────────────────────────────────────────────────────────────────

export type ID = string;
export type Tick = number;
export type Money = number;
export type Percent = number; // 0..1 unless stated otherwise
export type KV = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// Global Enums (string unions for stable serialization)
// ─────────────────────────────────────────────────────────────────────────────

export type RunPhase = 'EARLY' | 'MID' | 'LATE';
export type TickTier = 'STANDARD' | 'ELEVATED' | 'CRITICAL';
export type MacroRegime = 'BULL' | 'NEUTRAL' | 'BEAR' | 'CRISIS';
export type PressureTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SolvencyStatus = 'SOLVENT' | 'BLEED' | 'WIPED';

// ─────────────────────────────────────────────────────────────────────────────
// Player Profile (portable snapshot; used by onboarding + personalization)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PlayerProfile
 * Shared, portable snapshot of player preferences + current run context.
 * (Added so mechanics like M44 can accept a typed profile without introducing a new module.)
 */
export interface PlayerProfile {
  userId?: ID;

  // Run context (optional; mechanics can fall back safely)
  runSeed?: ID;
  tick?: Tick;
  runPhase?: RunPhase;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;

  // Preference + style hints (optional)
  archetype?: string;
  riskTolerance?: Percent; // 0..1
  preferredCardIds?: ID[];
  preferredAssetTypes?: string[];

  // Freeform notes (JSON-safe)
  notes?: KV;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Domain Objects
// ─────────────────────────────────────────────────────────────────────────────

export interface Asset {
  id: ID;
  value: Money;
  cashflowMonthly: Money;
  purchasePrice?: Money;
}

export interface IPAItem {
  id: ID;
  cashflowMonthly: Money;
}

export interface GameCard {
  id: ID;
  name: string;
  type: string;

  // Optional economic attributes depending on card type
  cost?: Money | null;
  downPayment?: Money | null;
  shieldValue?: Money;

  // Optional linkage (e.g., modifies a specific asset)
  targetAssetId?: ID;
}

export interface GameEvent {
  type: string;
  damage?: Money;
  payload?: KV;
}

export interface ShieldLayer {
  id: ID;
  strength: Money;
  type: string;
}

export interface Debt {
  id: ID;
  amount: Money;
  interestRate: Percent; // e.g., 0.08 = 8%
}

export interface Buff {
  id: ID;
  type: string;
  magnitude: number;
  expiresAt: Tick;
}

export interface Liability {
  id: ID;
  amount: Money;
}

export interface SetBonus {
  setId: ID;
  bonus: number;
  description: string;
}

export interface AssetMod {
  modId: ID;
  assetId: ID;
  statKey: string;
  delta: number;
}

export interface IncomeItem {
  source: string;
  amount: Money;
}

/**
 * Timer
 * Generic timer payload used across mechanics (shape is intentionally permissive).
 * - MUST include a stable id and an absolute expiry tick.
 * - May include any additional JSON-safe fields.
 */
export type Timer = KV & {
  id: ID;
  expiresAt: Tick;
};

// ─────────────────────────────────────────────────────────────────────────────
// Macro / Chaos Timelines
// ─────────────────────────────────────────────────────────────────────────────

export interface MacroEvent {
  tick: Tick;
  type: string;
  regimeChange?: MacroRegime;
}

export interface ChaosWindow {
  startTick: Tick;
  endTick: Tick;
  type: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Results / Outcomes (mechanics return these frequently)
// ─────────────────────────────────────────────────────────────────────────────

export interface AuctionResult {
  winnerId: ID;
  winnerBid: Money;
  expired: boolean;
}

export interface PurchaseResult {
  success: boolean;
  assetId: ID;
  cashSpent: Money;
  leverageAdded: Money;
  reason: string;
}

export interface ShieldResult {
  absorbed: Money;
  pierced: boolean;
  depleted: boolean;
  remainingShield: Money;
}

export interface ExitResult {
  assetId: ID;
  saleProceeds: Money;
  capitalGain: Money;
  timingScore: number;
  macroRegime: MacroRegime;
}

export interface TickResult {
  tick: Tick;
  runPhase: RunPhase;
  timerExpired: boolean;
}

export interface DeckComposition {
  totalCards: number;
  byType: Record<string, number>;
}

export interface TierProgress {
  currentTier: PressureTier;
  progressPct: Percent; // 0..1
}

// ─────────────────────────────────────────────────────────────────────────────
// Exceptional Events (wipes, regime shifts, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export interface WipeEvent {
  reason: string;
  tick: Tick;
  cash: Money;
  netWorth: Money;
}

export interface RegimeShiftEvent {
  previousRegime: MacroRegime;
  newRegime: MacroRegime;
}

export interface PhaseTransitionEvent {
  from: RunPhase;
  to: RunPhase;
}

export interface TimerExpiredEvent {
  tick: Tick;
}

export interface StreakEvent {
  streakLength: number;
  taxApplied: boolean;
}

export interface FubarEvent {
  level: number;
  type: string;
  damage: Money;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger / Proof Artifacts
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  gameAction: unknown;
  tick: Tick;
  hash: string;
}

export interface ProofCard {
  runId: ID;
  cordScore: number;
  hash: string;
  grade: string;
}

export interface CompletedRun {
  runId: ID;
  userId: ID;
  cordScore: number;
  outcome: string;
  ticks: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime State Snapshots (minimal, deterministic)
// ─────────────────────────────────────────────────────────────────────────────

/** Season runtime snapshot (minimal). Claimed rewards are tracked by RewardEntry.id. */
export interface SeasonState {
  seasonId: ID;
  tick: Tick;
  rewardsClaimed: ID[];
}

export interface RunState {
  cash: Money;
  netWorth: Money;
  tick: Tick;
  runPhase: RunPhase;
}

// ─────────────────────────────────────────────────────────────────────────────
// Media / Share / Clip Hooks
// ─────────────────────────────────────────────────────────────────────────────

export interface MomentEvent {
  type: string;
  tick: Tick;
  highlight: string;
  shareReady: boolean;
}

export interface ClipBoundary {
  startTick: Tick;
  endTick: Tick;
  triggerEvent: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Season Rewards (required by M19 meta-system)
// ─────────────────────────────────────────────────────────────────────────────

export type RewardKind = 'CARD' | 'COSMETIC' | 'CURRENCY' | 'TITLE' | 'MODULE';

/**
 * RewardEntry
 * Deterministic season reward definition.
 * - `id` MUST be stable across server verification (seed + config).
 * - `unlockTick` is absolute within the season timeline.
 */
export interface RewardEntry {
  id: ID;
  kind: RewardKind;
  unlockTick: Tick;

  // Optional depending on kind
  cardId?: ID;
  amount?: Money;

  // Extensible metadata (UI/analytics); must remain JSON-safe at runtime.
  meta?: KV;
}

/**
 * SeasonConfig
 * Minimal configuration used by season meta mechanics (e.g., M19).
 */
export interface SeasonConfig {
  seasonId: ID;
  startTick: Tick;
  endTick: Tick;

  rewardTable: RewardEntry[];

  /**
   * Optional salt to rotate seasons without destabilizing player identity seeds.
   * (Used only for deterministic derivations; never trusted for authorization.)
   */
  seedSalt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mechanic Telemetry Envelope
// ─────────────────────────────────────────────────────────────────────────────

export interface MechanicTelemetryPayload {
  event: string;
  mechanic_id: string;
  tick: Tick;
  runId: ID;
  payload: KV;
}

export type MechanicEmitter = (p: MechanicTelemetryPayload) => void;