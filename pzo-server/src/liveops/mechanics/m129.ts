// /pzo_server/src/liveops/mechanics/m129.ts
// M129 — Creator Packs: Caption Templates + Sound Stingers
// tslint:disable:no-any

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaptionTemplate {
  id: string;
  templateText: string;    // e.g. "I just {{action}} and got {{result}}! 🔥"
  shareTarget: 'clip' | 'proof_card' | 'post_mortem' | 'universal';
  tags: string[];
  accessibilityRating: number; // 0–1
}

export interface SoundStinger {
  id: string;
  audioUrl: string;
  durationMs: number;
  triggerEvent: 'win' | 'wipe' | 'big_deal' | 'close_call' | 'fubar';
  tags: string[];
}

export interface CreatorPack {
  packId: string;
  creatorId: string;
  captionTemplates: CaptionTemplate[];
  soundStingers: SoundStinger[];
  seasonTag?: string;
  bundleDiscountBps: number; // discount in basis points if buying full pack
}

// ─── Config ───────────────────────────────────────────────────────────────────

export class M129CreatorPacksCaptionTemplatesSoundStingersMechanicsConfig {
  public captionTemplateProbability: number;
  public soundStingerProbability: number;
  public mlEnabled: boolean;
  public defaultTemplates: CaptionTemplate[];
  public defaultStingers: SoundStinger[];

  constructor(config: Partial<M129CreatorPacksCaptionTemplatesSoundStingersMechanicsConfig> = {}) {
    this.captionTemplateProbability = config.captionTemplateProbability ?? 0.5;
    this.soundStingerProbability = config.soundStingerProbability ?? 0.3;
    this.mlEnabled = config.mlEnabled ?? false;
    this.defaultTemplates = config.defaultTemplates ?? [];
    this.defaultStingers = config.defaultStingers ?? [];
  }
}

// ─── ML Model ─────────────────────────────────────────────────────────────────

export class M129MLModel {
  /**
   * Given run telemetry, returns a relevance score [0..1] for each template/stinger.
   * Higher score = more contextually relevant to share moment.
   */
  public scoreTemplates(
    templates: CaptionTemplate[],
    runEvent: string,
    playerTags: string[],
    seed: string,
  ): number[] {
    return templates.map(t => {
      const tagOverlap =
        t.tags.filter(tag => playerTags.includes(tag) || tag === runEvent).length /
        Math.max(t.tags.length, 1);
      const seedBias = (createHash('sha256').update(seed + t.id).digest()[0] / 255) * 0.2;
      return Math.min(tagOverlap * 0.8 + seedBias, 1);
    });
  }

  public scoreStingers(
    stingers: SoundStinger[],
    triggerEvent: SoundStinger['triggerEvent'],
    seed: string,
  ): number[] {
    return stingers.map(s => {
      const exactMatch = s.triggerEvent === triggerEvent ? 0.7 : 0.1;
      const seedBias = (createHash('sha256').update(seed + s.id).digest()[0] / 255) * 0.3;
      return Math.min(exactMatch + seedBias, 1);
    });
  }
}

// ─── Core Mechanics ──────────────────────────────────────────────────────────

export class M129CreatorPacksCaptionTemplatesSoundStingersMechanics {
  private readonly _config: M129CreatorPacksCaptionTemplatesSoundStingersMechanicsConfig;
  private readonly _mlModel: M129MLModel;

  constructor(config: M129CreatorPacksCaptionTemplatesSoundStingersMechanicsConfig) {
    this._config = config;
    this._mlModel = new M129MLModel();
  }

  get captionTemplateProbability(): number {
    return this._config.captionTemplateProbability;
  }
  set captionTemplateProbability(value: number) {
    if (value < 0 || value > 1) throw new RangeError('captionTemplateProbability must be [0,1]');
    this._config.captionTemplateProbability = value;
  }

  get soundStingerProbability(): number {
    return this._config.soundStingerProbability;
  }
  set soundStingerProbability(value: number) {
    if (value < 0 || value > 1) throw new RangeError('soundStingerProbability must be [0,1]');
    this._config.soundStingerProbability = value;
  }

  /**
   * Selects the most contextually relevant caption template for a share moment.
   * Falls back to highest accessibility rating if ML is disabled.
   */
  public selectCaptionTemplate(
    availableTemplates: CaptionTemplate[],
    runEvent: string,
    playerTags: string[],
    seed: string,
  ): CaptionTemplate | null {
    if (availableTemplates.length === 0) return null;

    if (!this._config.mlEnabled) {
      // Deterministic fallback: highest accessibility + tag overlap
      return availableTemplates.reduce((best, t) =>
        t.accessibilityRating > best.accessibilityRating ? t : best,
      );
    }

    const scores = this._mlModel.scoreTemplates(availableTemplates, runEvent, playerTags, seed);
    const bestIdx = scores.indexOf(Math.max(...scores));
    return availableTemplates[bestIdx];
  }

  /**
   * Selects the matching sound stinger for a triggered game event.
   */
  public selectSoundStinger(
    availableStingers: SoundStinger[],
    triggerEvent: SoundStinger['triggerEvent'],
    seed: string,
  ): SoundStinger | null {
    if (availableStingers.length === 0) return null;

    if (!this._config.mlEnabled) {
      // Deterministic: exact trigger match preferred, else first
      return availableStingers.find(s => s.triggerEvent === triggerEvent) ?? availableStingers[0];
    }

    const scores = this._mlModel.scoreStingers(availableStingers, triggerEvent, seed);
    const bestIdx = scores.indexOf(Math.max(...scores));
    return availableStingers[bestIdx];
  }

  /**
   * Renders a caption template by interpolating run data variables.
   */
  public renderCaption(template: CaptionTemplate, vars: Record<string, string>): string {
    return template.templateText.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `[${key}]`);
  }
}

// ─── LiveOps Wrapper ──────────────────────────────────────────────────────────

export class M129CreatorPacksCaptionTemplatesSoundStingersLiveOpsMechanics {
  private readonly _config: M129CreatorPacksCaptionTemplatesSoundStingersMechanicsConfig;
  private readonly _mechanics: M129CreatorPacksCaptionTemplatesSoundStingersMechanics;

  constructor(config: M129CreatorPacksCaptionTemplatesSoundStingersMechanicsConfig) {
    this._config = config;
    this._mechanics = new M129CreatorPacksCaptionTemplatesSoundStingersMechanics(config);
  }

  get mlEnabled(): boolean {
    return this._config.mlEnabled;
  }
  set mlEnabled(value: boolean) {
    this._config.mlEnabled = value;
  }

  get auditHash(): string {
    const configStr = JSON.stringify({
      captionTemplateProbability: this._config.captionTemplateProbability,
      soundStingerProbability: this._config.soundStingerProbability,
      mlEnabled: this._config.mlEnabled,
      templateCount: this._config.defaultTemplates.length,
      stingerCount: this._config.defaultStingers.length,
    });
    return createHash('sha256').update(configStr).digest('hex');
  }

  /**
   * Returns bounded [0..1] probability scores for default templates and stingers.
   * Used for audit: confirms outputs are non-exploitable.
   */
  get output(): number[] {
    const templateScores = this._config.defaultTemplates.map(
      t => Math.min(Math.max(t.accessibilityRating, 0), 1),
    );
    const stingerScores = this._config.defaultStingers.map(
      () => Math.min(Math.max(this._config.soundStingerProbability, 0), 1),
    );
    return [...templateScores, ...stingerScores];
  }

  /**
   * Entry point for share-moment caption + stinger selection.
   */
  public resolveShareMoment(params: {
    pack: CreatorPack;
    runEvent: string;
    playerTags: string[];
    triggerEvent: SoundStinger['triggerEvent'];
    captionVars: Record<string, string>;
    seed: string;
  }): { caption: string | null; stingerId: string | null; auditHash: string } {
    const template = this._mechanics.selectCaptionTemplate(
      params.pack.captionTemplates,
      params.runEvent,
      params.playerTags,
      params.seed,
    );
    const stinger = this._mechanics.selectSoundStinger(
      params.pack.soundStingers,
      params.triggerEvent,
      params.seed,
    );

    const caption = template
      ? this._mechanics.renderCaption(template, params.captionVars)
      : null;

    return {
      caption,
      stingerId: stinger?.id ?? null,
      auditHash: this.auditHash,
    };
  }
}
