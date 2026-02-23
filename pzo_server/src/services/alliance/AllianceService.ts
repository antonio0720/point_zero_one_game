/**
 * AllianceService.ts
 * Vault balance management, boost ledger queries, shield enforcement.
 * Supporting service for AllianceWarService (T170, T173, T178).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Alliance {
  allianceId: string;
  name: string;
  banner: string;        // URL to banner image
  vaultBalance: number;
  shieldExpiresAt: Date | null;
  rank: 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
  memberCount: number;
  createdAt: Date;
}

export interface AllianceMember {
  memberId: string;
  allianceId: string;
  playerId: string;
  rank: 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
  joinedAt: Date;
  warContributions: number;
}

export interface VaultSummary {
  allianceId: string;
  currentBalance: number;
  shieldActive: boolean;
  shieldExpiresAt: Date | null;
  canDeclareWar: boolean;
  pendingPlunder: number;
}

export interface IAllianceDatabase {
  getAlliance(allianceId: string): Promise<Alliance | null>;
  updateVaultBalance(allianceId: string, delta: number, idempotencyKey: string): Promise<number>;
  setShield(allianceId: string, expiresAt: Date): Promise<void>;
  getShield(allianceId: string): Promise<Date | null>;
  clearShield(allianceId: string): Promise<void>;
  getVaultLedger(allianceId: string, limit?: number): Promise<import('./AllianceWarService').VaultLedgerEntry[]>;
  getMembers(allianceId: string): Promise<AllianceMember[]>;
}

// ─── AllianceService ──────────────────────────────────────────────────────────

export class AllianceService {
  constructor(
    private readonly db: IAllianceDatabase,
    private readonly featureFlags: { warEnabled: boolean },
  ) {}

  // ── Vault queries ───────────────────────────────────────────────────────────

  async getVaultSummary(allianceId: string): Promise<VaultSummary> {
    const alliance = await this.db.getAlliance(allianceId);
    if (!alliance) throw new Error(`Alliance not found: ${allianceId}`);

    const shieldExpiry = await this.db.getShield(allianceId);
    const now = new Date();
    const shieldActive = shieldExpiry !== null && shieldExpiry > now;

    return {
      allianceId,
      currentBalance:  alliance.vaultBalance,
      shieldActive,
      shieldExpiresAt: shieldExpiry,
      canDeclareWar:   this.featureFlags.warEnabled && !shieldActive && alliance.memberCount >= 3,
      pendingPlunder:  0, // resolved at settlement
    };
  }

  /** T173: Validate vault has enough balance before boost spend or plunder */
  async assertSufficientVault(allianceId: string, amount: number): Promise<void> {
    const alliance = await this.db.getAlliance(allianceId);
    if (!alliance) throw new Error(`Alliance not found: ${allianceId}`);
    if (alliance.vaultBalance < amount) {
      throw new Error(
        `Insufficient vault balance. Has: ${alliance.vaultBalance}, needs: ${amount}`
      );
    }
  }

  /** T178: Check shield is not active before allowing war declaration */
  async assertNotShielded(allianceId: string): Promise<void> {
    const expiry = await this.db.getShield(allianceId);
    if (expiry && expiry > new Date()) {
      const remaining = Math.ceil((expiry.getTime() - Date.now()) / 1000 / 60);
      throw new Error(
        `Alliance is shielded. Shield expires in ${remaining} minutes.`
      );
    }
  }

  // ── Alliance banner (used in T194 WAR_ALERT payloads) ──────────────────────

  async getBannerMetadata(allianceId: string): Promise<{ banner: string; name: string }> {
    const alliance = await this.db.getAlliance(allianceId);
    if (!alliance) throw new Error(`Alliance not found: ${allianceId}`);
    return { banner: alliance.banner, name: alliance.name };
  }

  // ── Vault ledger audit ──────────────────────────────────────────────────────

  async getVaultAuditTrail(
    allianceId: string,
    limit = 50,
  ): Promise<import('./AllianceWarService').VaultLedgerEntry[]> {
    return this.db.getVaultLedger(allianceId, limit);
  }
}
