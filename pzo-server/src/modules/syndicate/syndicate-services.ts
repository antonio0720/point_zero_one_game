// pzo-server/src/modules/syndicate/trust-score.service.ts
import { Injectable } from '@nestjs/common';
import {
  INITIAL_TRUST_STATE, applyTrustImpact, applyAidFulfillment, decayTrustPassive,
} from '../../../../pzo-web/src/game/modes/syndicate/trustScoreEngine';
import type { TrustScoreState } from '../../../../pzo-web/src/game/modes/syndicate/trustScoreEngine';

@Injectable()
export class TrustScoreService {
  private scores = new Map<string, TrustScoreState>(); // key = `${roomId}:${userId}`

  private key(roomId: string, userId: string) { return `${roomId}:${userId}`; }

  async getScore(roomId: string, userId: string): Promise<TrustScoreState> {
    return this.scores.get(this.key(roomId, userId)) ?? INITIAL_TRUST_STATE;
  }

  async applyImpact(roomId: string, userId: string, trustImpact: number, tick: number): Promise<TrustScoreState> {
    const state = await this.getScore(roomId, userId);
    const updated = applyTrustImpact(state, trustImpact, tick);
    this.scores.set(this.key(roomId, userId), updated);
    return updated;
  }

  async applyAidFulfillment(roomId: string, userId: string, tick: number): Promise<TrustScoreState> {
    const state = await this.getScore(roomId, userId);
    const updated = applyAidFulfillment(state, tick);
    this.scores.set(this.key(roomId, userId), updated);
    return updated;
  }

  async tickDecay(roomId: string, userId: string, tick: number): Promise<TrustScoreState> {
    const state = await this.getScore(roomId, userId);
    const updated = decayTrustPassive(state, tick);
    this.scores.set(this.key(roomId, userId), updated);
    return updated;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// pzo-server/src/modules/syndicate/contracts.service.ts
import { Injectable as Injectable2 } from '@nestjs/common';
import { createAidContract, acceptContract, repayContract, breachContract, checkContractExpiry } from '../../../../pzo-web/src/game/modes/syndicate/aidContractEngine';
import type { AidContract, AidContractCreateInput } from '../../../../pzo-web/src/game/modes/syndicate/aidContractEngine';

@Injectable2()
export class ContractsService {
  private contracts = new Map<string, AidContract[]>(); // roomId → contracts[]

  async createContract(roomId: string, input: AidContractCreateInput): Promise<AidContract> {
    const contract = createAidContract(input);
    const existing = this.contracts.get(roomId) ?? [];
    this.contracts.set(roomId, [...existing, contract]);
    return contract;
  }

  async acceptContract(roomId: string, contractId: string, tick: number): Promise<AidContract> {
    const contracts = this.contracts.get(roomId) ?? [];
    const updated = contracts.map(c => c.id === contractId ? acceptContract(c, tick) : c);
    this.contracts.set(roomId, updated);
    return updated.find(c => c.id === contractId)!;
  }

  async repayContract(roomId: string, contractId: string, tick: number): Promise<AidContract | null> {
    const contracts = this.contracts.get(roomId) ?? [];
    const updated = contracts.map(c => c.id === contractId ? repayContract(c, tick) : c);
    this.contracts.set(roomId, updated);
    return updated.find(c => c.id === contractId) ?? null;
  }

  async checkExpiries(roomId: string, tick: number): Promise<AidContract[]> {
    const contracts = this.contracts.get(roomId) ?? [];
    const updated = contracts.map(c => checkContractExpiry(c, tick));
    this.contracts.set(roomId, updated);
    return updated.filter(c => c.status === 'BREACHED');
  }

  async getContracts(roomId: string): Promise<AidContract[]> {
    return this.contracts.get(roomId) ?? [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// pzo-server/src/modules/syndicate/defection.service.ts
import { Injectable as Injectable3 } from '@nestjs/common';
import { INITIAL_DEFECTION_STATE, advanceDefection, detectDefection } from '../../../../pzo-web/src/game/modes/syndicate/defectionSequenceEngine';
import type { DefectionSequenceState, DefectionStep } from '../../../../pzo-web/src/game/modes/syndicate/defectionSequenceEngine';

@Injectable3()
export class DefectionService {
  private sequences = new Map<string, DefectionSequenceState>(); // `${roomId}:${userId}`

  private key(roomId: string, userId: string) { return `${roomId}:${userId}`; }

  async advanceStep(roomId: string, userId: string, step: DefectionStep, tick: number) {
    const state = this.sequences.get(this.key(roomId, userId)) ?? INITIAL_DEFECTION_STATE;
    const result = advanceDefection(state, step, tick);
    this.sequences.set(this.key(roomId, userId), result.newState);
    return result;
  }

  async attemptDetect(roomId: string, suspectId: string, detectorId: string, suspicionLevel: number) {
    const state = this.sequences.get(this.key(roomId, suspectId));
    if (!state) return null;
    const updated = detectDefection(state, detectorId, suspicionLevel);
    this.sequences.set(this.key(roomId, suspectId), updated);
    return updated;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// pzo-server/src/modules/syndicate/shared-treasury.service.ts
import { Injectable as Injectable4 } from '@nestjs/common';
import { INITIAL_TREASURY_STATE, depositToTreasury, withdrawFromTreasury, disburseTreasuryRescue, seizeDefectorShare } from '../../../../pzo-web/src/game/modes/syndicate/sharedTreasuryEngine';
import type { SharedTreasuryState } from '../../../../pzo-web/src/game/modes/syndicate/sharedTreasuryEngine';

@Injectable4()
export class SharedTreasuryService {
  private treasuries = new Map<string, SharedTreasuryState>();

  async getState(roomId: string): Promise<SharedTreasuryState> {
    return this.treasuries.get(roomId) ?? INITIAL_TREASURY_STATE;
  }

  async deposit(roomId: string, playerId: string, amount: number, tick: number): Promise<SharedTreasuryState> {
    const state = await this.getState(roomId);
    const updated = depositToTreasury(state, playerId, amount, tick);
    this.treasuries.set(roomId, updated);
    return updated;
  }

  async withdraw(roomId: string, playerId: string, amount: number, tick: number) {
    const state = await this.getState(roomId);
    const result = withdrawFromTreasury(state, playerId, amount, tick);
    if (result.success) this.treasuries.set(roomId, result.updatedState);
    return result;
  }

  async disburseRescue(roomId: string, recipientId: string, amount: number, tick: number) {
    const state = await this.getState(roomId);
    const { disbursed, updatedState } = disburseTreasuryRescue(state, recipientId, amount, tick);
    this.treasuries.set(roomId, updatedState);
    return disbursed;
  }

  async seizeDefectorShare(roomId: string, defectorId: string, amount: number, tick: number) {
    const state = await this.getState(roomId);
    const updated = seizeDefectorShare(state, defectorId, amount, tick);
    this.treasuries.set(roomId, updated);
    return updated;
  }
}
