// /pzo_server/src/liveops/mechanics/m130.ts
// M130 — Table Vault: Shared Cosmetic Stash
// tslint:disable:no-any

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VaultRewardType = 'fragment' | 'proof_skin' | 'title' | 'frame' | 'lobby_banner' | 'credit';

export interface VaultEntry {
  cosmeticId: string;
  rewardType: VaultRewardType;
  depositedBy: string;     // playerId
  depositedAt: number;     // timestamp ms
  quantity: number;
  escrowed: boolean;       // true = locked until claim window
  claimWindowEndAt?: number;
}

export interface VaultWithdrawal {
  cosmeticId: string;
  rewardType: VaultRewardType;
  quantity: number;
  withdrawnBy: string;
  withdrawnAt: number;
  receiptHash: string;
}

export interface TableVaultState {
  tableId: string;
  members: string[];          // playerIds allowed to access vault
  entries: VaultEntry[];
  withdrawalLog: VaultWithdrawal[];
  version: number;            // optimistic locking
}

// ─── Config ───────────────────────────────────────────────────────────────────

export class M130TableVaultSharedCosmeticStashConfig {
  enabled: boolean = false;
  ml_enabled: boolean = false;
  maxEntriesPerTable: number = 500;
  claimWindowMs: number = 86_400_000; // 24 hours default
  maxWithdrawPerPlayerPerDay: number = 10;

  constructor(overrides?: Partial<M130TableVaultSharedCosmeticStashConfig>) {
    if (overrides) Object.assign(this, overrides);
  }
}

// ─── Mechanic ─────────────────────────────────────────────────────────────────

export class M130TableVaultSharedCosmeticStashMechanic {
  /**
   * Deposits a cosmetic item into the shared vault.
   * Items enter escrow for claimWindowMs before becoming freely withdrawable.
   */
  public deposit(
    vault: TableVaultState,
    deposit: Omit<VaultEntry, 'depositedAt' | 'escrowed' | 'claimWindowEndAt'>,
    config: M130TableVaultSharedCosmeticStashConfig,
  ): { success: boolean; error?: string } {
    if (!config.enabled) return { success: false, error: 'Vault is disabled' };
    if (!vault.members.includes(deposit.depositedBy)) {
      return { success: false, error: 'Player is not a table member' };
    }
    if (vault.entries.length >= config.maxEntriesPerTable) {
      return { success: false, error: 'Vault is full' };
    }

    const now = Date.now();
    vault.entries.push({
      ...deposit,
      depositedAt: now,
      escrowed: true,
      claimWindowEndAt: now + config.claimWindowMs,
    });
    vault.version++;

    return { success: true };
  }

  /**
   * Withdraws a cosmetic from the vault if the claim window has passed
   * and the player hasn't exceeded their daily withdrawal limit.
   */
  public withdraw(
    vault: TableVaultState,
    playerId: string,
    cosmeticId: string,
    rewardType: VaultRewardType,
    config: M130TableVaultSharedCosmeticStashConfig,
  ): { success: boolean; withdrawal?: VaultWithdrawal; error?: string } {
    if (!config.enabled) return { success: false, error: 'Vault is disabled' };
    if (!vault.members.includes(playerId)) {
      return { success: false, error: 'Player is not a table member' };
    }

    // Daily withdrawal limit check
    const dayAgo = Date.now() - 86_400_000;
    const todayCount = vault.withdrawalLog.filter(
      w => w.withdrawnBy === playerId && w.withdrawnAt > dayAgo,
    ).length;
    if (todayCount >= config.maxWithdrawPerPlayerPerDay) {
      return { success: false, error: 'Daily withdrawal limit reached' };
    }

    // Find a matching available entry (claim window must have passed)
    const now = Date.now();
    const entryIdx = vault.entries.findIndex(
      e =>
        e.cosmeticId === cosmeticId &&
        e.rewardType === rewardType &&
        e.quantity > 0 &&
        (!e.escrowed || (e.claimWindowEndAt !== undefined && now >= e.claimWindowEndAt)),
    );

    if (entryIdx < 0) {
      return { success: false, error: 'Item not available for withdrawal' };
    }

    vault.entries[entryIdx].quantity--;
    vault.entries[entryIdx].escrowed = false;
    if (vault.entries[entryIdx].quantity === 0) {
      vault.entries.splice(entryIdx, 1);
    }

    const withdrawal: VaultWithdrawal = {
      cosmeticId,
      rewardType,
      quantity: 1,
      withdrawnBy: playerId,
      withdrawnAt: now,
      receiptHash: createHash('sha256')
        .update(`${vault.tableId}:${playerId}:${cosmeticId}:${now}`)
        .digest('hex')
        .slice(0, 32),
    };

    vault.withdrawalLog.push(withdrawal);
    vault.version++;

    return { success: true, withdrawal };
  }

  /**
   * Returns normalized reward score [0..1] for a given reward type.
   * Used by upstream systems to gauge vault activity health.
   */
  public async getReward(
    playerId: string,
    rewardType: VaultRewardType,
    vault: TableVaultState,
    config: M130TableVaultSharedCosmeticStashConfig,
  ): Promise<number> {
    if (!config.enabled) return 0;

    const available = vault.entries.filter(
      e => e.rewardType === rewardType && !e.escrowed && e.quantity > 0,
    );

    if (available.length === 0) return 0;

    // Reward score = available fraction of max, normalized
    const totalQuantity = available.reduce((s, e) => s + e.quantity, 0);
    const normalized = Math.min(totalQuantity / 100, 1); // cap normalizer at 100 items
    return normalized;
  }

  /**
   * Deterministic audit hash of current vault state.
   */
  public async getAuditHash(vault: TableVaultState): Promise<string> {
    const payload = {
      tableId: vault.tableId,
      version: vault.version,
      entryCount: vault.entries.length,
      memberCount: vault.members.length,
      withdrawalCount: vault.withdrawalLog.length,
      topEntryIds: vault.entries.slice(0, 5).map(e => e.cosmeticId),
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}

// ─── LiveOps Wrapper ─────────────────────────────────────────────────────────

export class M130TableVaultSharedCosmeticStashLiveOpsMechanics {
  private readonly config: M130TableVaultSharedCosmeticStashConfig;
  private readonly mechanic: M130TableVaultSharedCosmeticStashMechanic;

  constructor(config: M130TableVaultSharedCosmeticStashConfig) {
    this.config = config;
    this.mechanic = new M130TableVaultSharedCosmeticStashMechanic();
  }

  public deposit(
    vault: TableVaultState,
    deposit: Omit<VaultEntry, 'depositedAt' | 'escrowed' | 'claimWindowEndAt'>,
  ) {
    return this.mechanic.deposit(vault, deposit, this.config);
  }

  public withdraw(
    vault: TableVaultState,
    playerId: string,
    cosmeticId: string,
    rewardType: VaultRewardType,
  ) {
    return this.mechanic.withdraw(vault, playerId, cosmeticId, rewardType, this.config);
  }

  public async getReward(
    vault: TableVaultState,
    playerId: string,
    rewardType: VaultRewardType,
  ): Promise<number> {
    const reward = await this.mechanic.getReward(playerId, rewardType, vault, this.config);
    return Math.min(Math.max(reward, 0), 1);
  }

  public async getAuditHash(vault: TableVaultState): Promise<string> {
    return this.mechanic.getAuditHash(vault);
  }

  public isMlEnabled(): boolean {
    return this.config.ml_enabled;
  }
}
