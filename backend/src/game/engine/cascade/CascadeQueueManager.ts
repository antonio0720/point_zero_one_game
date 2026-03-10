/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import { createDeterministicId } from '../core/Deterministic';
import type { CascadeChainInstance } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { CascadeTemplate } from './types';

export class CascadeQueueManager {
  public create(snapshot: RunStateSnapshot, template: CascadeTemplate, trigger: string): CascadeChainInstance {
    const acceleration = snapshot.modeState.bleedMode || snapshot.mode === 'ghost' ? 1 : 0;
    return {
      chainId: createDeterministicId(snapshot.seed, template.templateId, snapshot.tick, snapshot.cascade.activeChains.length),
      templateId: template.templateId,
      trigger,
      positive: template.positive,
      status: 'ACTIVE',
      createdAtTick: snapshot.tick,
      recoveryTags: template.recoveryTags,
      links: template.offsets.map((offset, index) => ({
        linkId: createDeterministicId(snapshot.seed, template.templateId, index, snapshot.tick),
        scheduledTick: snapshot.tick + Math.max(0, offset - acceleration),
        effect: {
          cashDelta: template.cashDelta,
          shieldDelta: template.shieldDelta,
          heatDelta: template.heatDelta,
          incomeDelta: template.incomeDelta,
        },
        summary: `${template.templateId}::${index + 1}`,
      })),
    };
  }
}
