/**
 * Durable player conversational fingerprinting.
 */
import type {
  ChatPlayerModelAxis,
  ChatPlayerModelEvidence,
  ChatPlayerModelSnapshot,
  ChatPlayerModelVector,
} from '../../../../../shared/contracts/chat/player-model';
import { clamp01 as clampNovelty } from '../../../../../shared/contracts/chat/novelty';

export interface ChatPlayerModelServiceConfig {
  readonly maxEvidenceTail: number;
}

export const DEFAULT_CHAT_PLAYER_MODEL_SERVICE_CONFIG: ChatPlayerModelServiceConfig = Object.freeze({
  maxEvidenceTail: 128,
});

interface PlayerModelBucket {
  snapshot: ChatPlayerModelSnapshot;
}

function now(): number { return Date.now(); }
function clamp01(value: number): number { return clampNovelty(value); }

function emptyVector(): ChatPlayerModelVector {
  return {
    impulsive01: 0.5,
    patient01: 0.5,
    greedy01: 0.5,
    defensive01: 0.5,
    bluffHeavy01: 0.5,
    literal01: 0.5,
    comebackProne01: 0.5,
    collapseProne01: 0.5,
    publicPerformer01: 0.5,
    silentOperator01: 0.5,
    procedureAware01: 0.5,
    careless01: 0.5,
    noveltySeeking01: 0.5,
    stabilitySeeking01: 0.5,
    rescueReliant01: 0.5,
  };
}

function dominantAxes(vector: ChatPlayerModelVector): readonly ChatPlayerModelAxis[] {
  return [
    ['IMPULSIVE', vector.impulsive01],
    ['PATIENT', vector.patient01],
    ['GREEDY', vector.greedy01],
    ['DEFENSIVE', vector.defensive01],
    ['BLUFF_HEAVY', vector.bluffHeavy01],
    ['LITERAL', vector.literal01],
    ['COMEBACK_PRONE', vector.comebackProne01],
    ['COLLAPSE_PRONE', vector.collapseProne01],
    ['PUBLIC_PERFORMER', vector.publicPerformer01],
    ['SILENT_OPERATOR', vector.silentOperator01],
    ['PROCEDURE_AWARE', vector.procedureAware01],
    ['CARELESS', vector.careless01],
    ['NOVELTY_SEEKING', vector.noveltySeeking01],
    ['STABILITY_SEEKING', vector.stabilitySeeking01],
    ['RESCUE_RELIANT', vector.rescueReliant01],
  ]
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4)
    .map(([axis]) => axis as ChatPlayerModelAxis);
}

export class ChatPlayerModelService {
  private readonly config: ChatPlayerModelServiceConfig;
  private readonly players = new Map<string, PlayerModelBucket>();

  public constructor(config: Partial<ChatPlayerModelServiceConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_CHAT_PLAYER_MODEL_SERVICE_CONFIG, ...config });
  }

  private ensure(playerId: string): PlayerModelBucket {
    const current = this.players.get(playerId);
    if (current) return current;
    const snapshot: ChatPlayerModelSnapshot = {
      profileId: `player-model:${playerId}`,
      playerId,
      createdAt: now(),
      updatedAt: now(),
      vector: emptyVector(),
      dominantAxes: dominantAxes(emptyVector()),
      evidenceTail: [],
      notes: [],
    };
    const bucket = { snapshot };
    this.players.set(playerId, bucket);
    return bucket;
  }

  public ingestEvidence(playerId: string, evidence: ChatPlayerModelEvidence): ChatPlayerModelSnapshot {
    const bucket = this.ensure(playerId);
    const vector = { ...bucket.snapshot.vector };
    const apply = (axis: keyof ChatPlayerModelVector, delta: number) => {
      vector[axis] = clamp01(vector[axis] * 0.72 + clamp01(vector[axis] + delta) * 0.28);
    };

    for (const axis of evidence.axes) {
      switch (axis) {
        case 'IMPULSIVE': apply('impulsive01', evidence.weight01 * 0.22); apply('patient01', -evidence.weight01 * 0.15); break;
        case 'PATIENT': apply('patient01', evidence.weight01 * 0.22); apply('impulsive01', -evidence.weight01 * 0.15); break;
        case 'GREEDY': apply('greedy01', evidence.weight01 * 0.20); apply('defensive01', -evidence.weight01 * 0.10); break;
        case 'DEFENSIVE': apply('defensive01', evidence.weight01 * 0.20); break;
        case 'BLUFF_HEAVY': apply('bluffHeavy01', evidence.weight01 * 0.20); apply('literal01', -evidence.weight01 * 0.10); break;
        case 'LITERAL': apply('literal01', evidence.weight01 * 0.18); break;
        case 'COMEBACK_PRONE': apply('comebackProne01', evidence.weight01 * 0.18); break;
        case 'COLLAPSE_PRONE': apply('collapseProne01', evidence.weight01 * 0.18); break;
        case 'PUBLIC_PERFORMER': apply('publicPerformer01', evidence.weight01 * 0.18); apply('silentOperator01', -evidence.weight01 * 0.10); break;
        case 'SILENT_OPERATOR': apply('silentOperator01', evidence.weight01 * 0.18); break;
        case 'PROCEDURE_AWARE': apply('procedureAware01', evidence.weight01 * 0.20); apply('careless01', -evidence.weight01 * 0.15); break;
        case 'CARELESS': apply('careless01', evidence.weight01 * 0.20); break;
        case 'NOVELTY_SEEKING': apply('noveltySeeking01', evidence.weight01 * 0.20); apply('stabilitySeeking01', -evidence.weight01 * 0.10); break;
        case 'STABILITY_SEEKING': apply('stabilitySeeking01', evidence.weight01 * 0.20); break;
        case 'RESCUE_RELIANT': apply('rescueReliant01', evidence.weight01 * 0.18); break;
      }
    }

    bucket.snapshot = {
      ...bucket.snapshot,
      updatedAt: evidence.createdAt,
      vector,
      dominantAxes: dominantAxes(vector),
      evidenceTail: [evidence, ...bucket.snapshot.evidenceTail].slice(0, this.config.maxEvidenceTail),
      notes: [
        `updated_from:${evidence.source}`,
        ...bucket.snapshot.notes,
      ].slice(0, 32),
    };
    return bucket.snapshot;
  }

  public getSnapshot(playerId: string): ChatPlayerModelSnapshot {
    return this.ensure(playerId).snapshot;
  }
}
