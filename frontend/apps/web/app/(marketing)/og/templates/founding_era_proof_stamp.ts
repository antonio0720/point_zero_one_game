/**
 * Founding Era Proof Stamp Template
 */

export interface FoundingEraProofStampOptions {
  /** The hash to be included in the proof stamp */
  hash: string;
}

export function foundingEraProofStampTemplate(options: FoundingEraProofStampOptions): string {
  const { hash } = options;

  // Replace placeholders with actual values
  const template = `
    <img src="/assets/founding_era_stamp.png" alt="Founding Era Stamp">
    <div class="proof-hash">${hash.substring(0, 8)}...</div>
  `;

  return template;
}
