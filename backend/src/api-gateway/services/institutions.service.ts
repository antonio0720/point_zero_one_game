//backend/src/api-gateway/services/institutions.service.ts

import pool from '../db/pool';

export type InstitutionStatus = 'active' | 'inactive' | 'archived';

export interface InstitutionRecord {
  id: number;
  ownerIdentityId: string;
  name: string;
  slug: string;
  status: InstitutionStatus;
  createdAt: string;
  updatedAt: string;
}

export type InstitutionUpdateInput = Partial<{
  name: string;
  slug: string;
  status: InstitutionStatus;
}>;

export class PgInstitutionsService {
  public async getInstitutionById(
    institutionId: number,
    identityId: string,
  ): Promise<InstitutionRecord | null> {
    const result = await pool.query<InstitutionRecord>(
      `
        SELECT
          id,
          owner_identity_id AS "ownerIdentityId",
          name,
          slug,
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM institutions
        WHERE id = $1
          AND owner_identity_id = $2
        LIMIT 1
      `,
      [institutionId, identityId],
    );

    return result.rows[0] ?? null;
  }

  public async updateInstitutionById(
    institutionId: number,
    input: InstitutionUpdateInput,
    identityId: string,
  ): Promise<InstitutionRecord | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (typeof input.name !== 'undefined') {
      updates.push(`name = $${index++}`);
      values.push(input.name);
    }

    if (typeof input.slug !== 'undefined') {
      updates.push(`slug = $${index++}`);
      values.push(input.slug);
    }

    if (typeof input.status !== 'undefined') {
      updates.push(`status = $${index++}`);
      values.push(input.status);
    }

    if (updates.length === 0) {
      return this.getInstitutionById(institutionId, identityId);
    }

    updates.push(`updated_at = NOW()`);

    values.push(institutionId);
    const institutionIdParam = index++;
    values.push(identityId);
    const identityIdParam = index++;

    const result = await pool.query<InstitutionRecord>(
      `
        UPDATE institutions
        SET ${updates.join(', ')}
        WHERE id = $${institutionIdParam}
          AND owner_identity_id = $${identityIdParam}
        RETURNING
          id,
          owner_identity_id AS "ownerIdentityId",
          name,
          slug,
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      values,
    );

    return result.rows[0] ?? null;
  }

  public async deleteInstitutionById(
    institutionId: number,
    identityId: string,
  ): Promise<number> {
    const result = await pool.query(
      `
        DELETE FROM institutions
        WHERE id = $1
          AND owner_identity_id = $2
      `,
      [institutionId, identityId],
    );

    return result.rowCount ?? 0;
  }
}

export default PgInstitutionsService;