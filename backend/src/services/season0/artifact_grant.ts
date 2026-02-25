/**
 * Grant artifact bundle on join, ensure atomic issuance, attach receipt, return immediate identity payload
 */

import { ArtifactBundle, IdentityPayload } from '../interfaces';
import db from '../database';

async function grantArtifact(playerId: number): Promise<IdentityPayload> {
  const artifactBundle: ArtifactBundle = await db.oneOrNone(`
    SELECT id, bundle FROM artifact_bundles WHERE id = $1;
  `, [1]); // Assuming there is a predefined artifact bundle with id=1

  if (!artifactBundle) {
    throw new Error('No artifact bundle found');
  }

  const receiptId = await db.one(`
