/**
 * Proof Card OG Template (Draft vs Verified)
 */

import { IProof } from "../../../interfaces/proof";

export function getOGTemplate(proof: IProof, isVerified: boolean): string {
  const proofHash = `#${proof.hash.slice(0, 8)}...`;
  const pivotHeadline = isVerified ? 'Verified Proof' : 'Draft Proof';

  return `<meta property="og:title" content="${pivotHeadline}" />
          <meta property="og:description" content="Proof Hash: ${proofHash}" />`;
}
