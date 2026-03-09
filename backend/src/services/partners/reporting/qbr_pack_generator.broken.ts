/**
 * Generates QBR pack JSON (metrics + narrative prompts) for renewals.
 */

import { Metric, NarrativePrompt } from './interfaces';

export interface QbrPack {
  metrics: Metric[];
  narrativePrompts: NarrativePrompt[];
}

export function generateQbrPack(renewals: any[]): QbrPack {
  // Implement the logic to generate the QBR pack from renewals data.
  // This is a placeholder implementation and should be replaced with actual logic.

  const metrics: Metric[] = [];
  const narrativePrompts: NarrativePrompt[] = [];

  renewals.forEach((renewal) => {
    metrics.push({
      name: 'Renewal Count',
      value: renewal.count,
    });

    narrativePrompts.push({
      id: renewal.id,
      text: `Congratulations on your successful renewal! You have been a valued partner for ${renewal.duration} years.`,
    });
  });

  return { metrics, narrativePrompts };
}
