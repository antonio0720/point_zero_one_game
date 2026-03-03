/**
 * Artifact Grant Service — Season 0
 * Point Zero One · Density6 LLC · Confidential
 *
 * Atomically issues an artifact bundle to a player on join:
 *   1. Fetch the designated bundle (bundle_id = 1 for Season 0)
 *   2. Open a DB transaction
 *   3. Insert artifact_issuances row (idempotent via ON CONFLICT)
 *   4. Insert receipt row
 *   5. Commit
 *   6. Return IdentityPayload for immediate session hydration
 *
 * Re-entrant safe: calling grantArtifact for the same playerId
 * a second time returns the existing issuance without duplication.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtifactBundle {
  id: number;
  name: string;
  bundle: ArtifactItem[];
  seasonId: number;
}

export interface ArtifactItem {
  type: 'card' | 'cosmetic' | 'title' | 'badge';
  itemId: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface ArtifactIssuance {
  issuanceId: string;
  playerId: number;
  bundleId: number;
  issuedAt: Date;
  items: ArtifactItem[];
}

export interface IdentityPayload {
  playerId:    number;
  issuanceId:  string;
  bundleId:    number;
  artifacts:   ArtifactItem[];
  issuedAt:    Date;
  isExisting:  boolean; // true if returning a previously issued bundle
}

// ─── DB Interface (inject real pg-promise instance) ───────────────────────────

export interface ArtifactGrantDb {
  tx<T>(fn: (t: ArtifactGrantDb) => Promise<T>): Promise<T>;
  oneOrNone<T>(query: string, values?: unknown[]): Promise<T | null>;
  one<T>(query: string, values?: unknown[]): Promise<T>;
  none(query: string, values?: unknown[]): Promise<void>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const SEASON0_BUNDLE_ID = 1;

export class ArtifactGrantService {
  constructor(private readonly db: ArtifactGrantDb) {}

  async grantArtifact(playerId: number): Promise<IdentityPayload> {
    // ── 1. Check for existing issuance (idempotency) ─────────────────────────
    const existing = await this.db.oneOrNone<ArtifactIssuance>(
      `SELECT i.issuance_id, i.player_id, i.bundle_id, i.issued_at, b.bundle
         FROM artifact_issuances i
         JOIN artifact_bundles   b ON b.id = i.bundle_id
        WHERE i.player_id = $1 AND i.bundle_id = $2`,
      [playerId, SEASON0_BUNDLE_ID],
    );

    if (existing) {
      return {
        playerId,
        issuanceId: existing.issuanceId,
        bundleId:   existing.bundleId,
        artifacts:  existing.items,
        issuedAt:   existing.issuedAt,
        isExisting: true,
      };
    }

    // ── 2. Fetch the bundle definition ────────────────────────────────────────
    const bundle = await this.db.oneOrNone<ArtifactBundle>(
      `SELECT id, name, bundle, season_id FROM artifact_bundles WHERE id = $1`,
      [SEASON0_BUNDLE_ID],
    );

    if (!bundle) {
      throw new Error(`[ArtifactGrant] No bundle found for bundle_id=${SEASON0_BUNDLE_ID}`);
    }

    // ── 3. Atomic grant transaction ───────────────────────────────────────────
    const payload = await this.db.tx<IdentityPayload>(async (t) => {
      // Insert issuance record — ON CONFLICT guards against race conditions
      const issuance = await t.one<{ issuance_id: string; issued_at: Date }>(
        `INSERT INTO artifact_issuances (player_id, bundle_id, issued_at)
              VALUES ($1, $2, NOW())
         ON CONFLICT (player_id, bundle_id) DO UPDATE
                 SET issued_at = artifact_issuances.issued_at
           RETURNING issuance_id, issued_at`,
        [playerId, SEASON0_BUNDLE_ID],
      );

      // Expand bundle items into individual issuance_items rows
      for (const item of bundle.bundle) {
        await t.none(
          `INSERT INTO artifact_issuance_items
                  (issuance_id, item_type, item_id, label, metadata)
               VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [
            issuance.issuance_id,
            item.type,
            item.itemId,
            item.label,
            JSON.stringify(item.metadata ?? {}),
          ],
        );
      }

      // Attach receipt
      await t.none(
        `INSERT INTO artifact_receipts (issuance_id, player_id, bundle_name, granted_at)
              VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [issuance.issuance_id, playerId, bundle.name],
      );

      return {
        playerId,
        issuanceId: issuance.issuance_id,
        bundleId:   SEASON0_BUNDLE_ID,
        artifacts:  bundle.bundle,
        issuedAt:   issuance.issued_at,
        isExisting: false,
      };
    });

    return payload;
  }
}

// ─── Standalone function export (for backwards-compat with original stub) ─────

export async function grantArtifact(
  playerId: number,
  db: ArtifactGrantDb,
): Promise<IdentityPayload> {
  return new ArtifactGrantService(db).grantArtifact(playerId);
}