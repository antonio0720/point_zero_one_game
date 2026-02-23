/**
 * AllianceService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SYNDICATE TREASURY & GOVERNANCE SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Treasury balance management, Market Play ledger queries, and Liquidity Shield
 * enforcement. Supporting service for the Syndicate Rivalry Protocol.
 *
 * Syndicates are real financial structures. Their treasuries are bounded,
 * monitored, and never trust-breaking. The platform can prove every movement.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Syndicate {
  syndicateId:     string;
  name:            string;
  banner:          string;           // CDN URL — used in Market Move Alert cards
  treasuryBalance: number;
  liquidityShieldExpiresAt: Date | null;
  partnerRank:     'ASSOCIATE' | 'JUNIOR_PARTNER' | 'PARTNER' | 'SENIOR_PARTNER' | 'MANAGING_PARTNER';
  memberCount:     number;
  createdAt:       Date;
}

export interface SyndicateMember {
  memberId:          string;
  syndicateId:       string;
  playerId:          string;
  partnerRank:       'ASSOCIATE' | 'JUNIOR_PARTNER' | 'PARTNER' | 'SENIOR_PARTNER' | 'MANAGING_PARTNER';
  joinedAt:          Date;
  rivalryContributions: number;   // Capital Score contributed across all rivalries
}

export interface TreasurySummary {
  syndicateId:              string;
  currentBalance:           number;
  liquidityShieldActive:    boolean;
  liquidityShieldExpiresAt: Date | null;
  canFileRivalryNotice:     boolean;
  pendingYieldCapture:      number;   // Resolved at LEDGER_CLOSE
}

export interface ISyndicateDatabase {
  getSyndicate(syndicateId: string): Promise<Syndicate | null>;
  updateTreasuryBalance(syndicateId: string, delta: number, idempotencyKey: string): Promise<number>;
  setLiquidityShield(syndicateId: string, expiresAt: Date): Promise<void>;
  getLiquidityShield(syndicateId: string): Promise<Date | null>;
  clearLiquidityShield(syndicateId: string): Promise<void>;
  getTreasuryLedger(syndicateId: string, limit?: number): Promise<import('./AllianceWarService').TreasuryLedgerEntry[]>;
  getMembers(syndicateId: string): Promise<SyndicateMember[]>;
}

// ─── AllianceService ──────────────────────────────────────────────────────────
// Internal name preserved for code stability.
// Player-facing identity: Syndicate Treasury & Governance

export class AllianceService {
  constructor(
    private readonly db: ISyndicateDatabase,
    private readonly featureFlags: { rivalryEnabled: boolean },
  ) {}

  // ── Treasury queries ────────────────────────────────────────────────────────

  /**
   * Returns full treasury summary for a Syndicate.
   * Includes Liquidity Shield status and rivalry eligibility.
   * Used before filing a Rivalry Notice — Syndicates must be solvent and unshielded.
   */
  async getTreasurySummary(syndicateId: string): Promise<TreasurySummary> {
    const syndicate = await this.db.getSyndicate(syndicateId);
    if (!syndicate) throw new Error(`Syndicate not found: ${syndicateId}`);

    const shieldExpiry = await this.db.getLiquidityShield(syndicateId);
    const now          = new Date();
    const shieldActive = shieldExpiry !== null && shieldExpiry > now;

    return {
      syndicateId,
      currentBalance:           syndicate.treasuryBalance,
      liquidityShieldActive:    shieldActive,
      liquidityShieldExpiresAt: shieldExpiry,
      // Must be enabled, unshielded, and have minimum 3 partners to file a Rivalry Notice
      canFileRivalryNotice:     this.featureFlags.rivalryEnabled && !shieldActive && syndicate.memberCount >= 3,
      pendingYieldCapture:      0,
    };
  }

  /**
   * T173: Assert treasury has sufficient balance before Market Play spend or Yield Capture.
   * Fail-closed — no silent failures on treasury operations.
   */
  async assertSufficientTreasury(syndicateId: string, amount: number): Promise<void> {
    const syndicate = await this.db.getSyndicate(syndicateId);
    if (!syndicate) throw new Error(`Syndicate not found: ${syndicateId}`);
    if (syndicate.treasuryBalance < amount) {
      throw new Error(
        `Insufficient Syndicate treasury. Balance: ${syndicate.treasuryBalance}, required: ${amount}.`
      );
    }
  }

  /**
   * T178: Assert Liquidity Shield is not active before allowing a Rivalry Notice.
   * A shielded Syndicate is in post-rivalry recovery — no new rivalries during shield window.
   */
  async assertLiquidityShieldClear(syndicateId: string): Promise<void> {
    const expiry = await this.db.getLiquidityShield(syndicateId);
    if (expiry && expiry > new Date()) {
      const remaining = Math.ceil((expiry.getTime() - Date.now()) / 1000 / 60);
      throw new Error(
        `Syndicate Liquidity Shield active. Shield expires in ${remaining} minutes. No rivalry notices during recovery window.`
      );
    }
  }

  // ── Syndicate banner — used in Market Move Alert payloads (T194) ────────────

  /**
   * Returns banner and name metadata for a Syndicate.
   * Used to populate rich Market Move Alert cards with Syndicate identity.
   */
  async getSyndicateBannerMetadata(syndicateId: string): Promise<{ banner: string; name: string }> {
    const syndicate = await this.db.getSyndicate(syndicateId);
    if (!syndicate) throw new Error(`Syndicate not found: ${syndicateId}`);
    return { banner: syndicate.banner, name: syndicate.name };
  }

  // ── Treasury audit trail ───────────────────────────────────────────────────

  /**
   * Returns paginated treasury ledger for audit.
   * Every entry has an idempotency key and is immutable once written.
   * The platform can prove every treasury movement. No vibes. Just receipts.
   */
  async getTreasuryAuditTrail(
    syndicateId: string,
    limit = 50,
  ): Promise<import('./AllianceWarService').TreasuryLedgerEntry[]> {
    return this.db.getTreasuryLedger(syndicateId, limit);
  }
}
