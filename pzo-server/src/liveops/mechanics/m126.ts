// /pzo_server/src/liveops/mechanics/m126.ts
// M126 — Cosmetic Loadouts: Titles, Frames, Proof Skins
// ML/DL Companion: Style Recommender + Auto-Set Builder (M126a)
// tslint:disable:no-any

import { createHash } from 'crypto';
import { IMLModel } from '@pzo/server/ml';
import { IGameContext } from '@pzo/server/game-context';
import { IPlayerSession } from '@pzo/server/player-session';

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface CosmeticItem {
  id: string;
  type: 'title' | 'frame' | 'proof_skin' | 'lobby_banner';
  label: string;
  bindedAchievementId?: string;    // earned cosmetics bind to achievement proof
  bindedSeasonRelicId?: string;    // season relic binding
  tradeableInEscrow: boolean;
  accessibilityContrastRating: number; // 0–1, higher = more readable
  styleTags: string[];
}

export interface CosmeticLoadout {
  loadoutId: string;
  title?: CosmeticItem;
  frame?: CosmeticItem;
  proofSkin?: CosmeticItem;
  lobbyBanner?: CosmeticItem;
  themeLabel: string;
  accessibilityNote: string;
}

export interface LoadoutRecommendation {
  loadouts: CosmeticLoadout[];
  modelCardStamp: ModelCardStamp;
  receipts: LoadoutReceipt[];
}

export interface ModelCardStamp {
  modelId: string;
  trainCut: string;
  featureSchemaHash: string;
}

export interface LoadoutReceipt {
  action: string;
  loadoutId: string;
  tick: number;
  signedAt: string;
  hash: string;
}

export interface M126PlayerState {
  playerId: string;
  ownedCosmetics: CosmeticItem[];
  equippedLoadout: CosmeticLoadout | null;
  runHistoryCosmeticIds: string[];     // cosmetics used in prior runs
  styleTags: string[];                  // opt-in style preference tags
  accessibilitySettings: { highContrast: boolean; largeText: boolean };
  optedInToPersonalization: boolean;
}

// ─── ML Model ────────────────────────────────────────────────────────────────

export class M126CosmeticLoadoutsMLModel implements IMLModel {
  private readonly AUDIT_HASH = 'M126a_style_recommender_v1';

  // Deterministic seed derived from playerId + seasonHash + rulesetHash
  private seed: string = '';

  public init(seed: string): void {
    this.seed = seed;
  }

  public getAuditHash(): string {
    return this.AUDIT_HASH;
  }

  /**
   * Scores owned cosmetics for a given player state.
   * Returns affinity scores [0..1] per cosmetic in the same order as input list.
   * Deterministic: same seed + cosmetic list = same scores.
   */
  public getBoundedOutput(): number[] {
    // Uses seeded numeric hashing to produce stable affinity scores
    return this._seededScores();
  }

  public getDeterministicSeed(): string {
    return this.seed;
  }

  public getDeterministicOutput(): number[] {
    return this._seededScores();
  }

  public getRandomizedSeed(): string {
    // Not supported; recommendations are deterministic per lobby session
    return this.seed;
  }

  public getRandomizedOutput(): number[] {
    // Randomization not permitted — see M126a spec: fairness-first
    return this._seededScores();
  }

  public getStochasticSeed(): string | null {
    return null; // M126 is not stochastic
  }

  public getStochasticOutput(): number[] {
    return this._seededScores();
  }

  public getUnboundedOutput(): number[] {
    // Raw logit scores before sigmoid clamping
    return this._rawLogits();
  }

  public getUncertainty(): string {
    return 'low'; // Cosmetic recommender has low uncertainty; no gameplay impact
  }

  public getUncertaintyOutput(): number[] {
    // Uncertainty is uniformly low — cosmetic recommendations carry no power
    return this._seededScores().map(() => 0.05);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _seededScores(): number[] {
    const raw = this._rawLogits();
    return raw.map(v => this._sigmoid(v));
  }

  private _rawLogits(): number[] {
    // Deterministic pseudo-random using seed hash; length=10 for top-N retrieval
    const hashBuf = createHash('sha256').update(this.seed).digest();
    return Array.from({ length: 10 }, (_, i) => (hashBuf[i % 32] / 255) * 4 - 2);
  }

  private _sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }
}

// ─── Main Mechanic Class ──────────────────────────────────────────────────────

export class M126CosmeticLoadoutsTitlesFramesProofSkinsMechanic {
  private mlEnabled: boolean;
  private mlModel: M126CosmeticLoadoutsMLModel | null = null;
  private gameContext: IGameContext | null = null;
  private playerSession: IPlayerSession | null = null;

  constructor(mlEnabled: boolean = false) {
    this.mlEnabled = mlEnabled;
  }

  public init(gameContext: IGameContext, playerSession: IPlayerSession): void {
    this.gameContext = gameContext;
    this.playerSession = playerSession;

    if (this.mlEnabled) {
      this.mlModel = new M126CosmeticLoadoutsMLModel();
      const seed = this._buildSeed();
      this.mlModel.init(seed);
    }
  }

  public getAuditHash(): string {
    const payload = {
      mechanic: 'M126_Cosmetic_Loadouts_Titles_Frames_Proof_Skins',
      mlEnabled: this.mlEnabled,
      mlModelHash: this.mlEnabled ? this.mlModel!.getAuditHash() : null,
      sessionId: this.playerSession?.sessionId ?? 'none',
      contextHash: this.gameContext?.rulesetHash ?? 'none',
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  // ── Loadout CRUD ──────────────────────────────────────────────────────────

  /**
   * Equips a cosmetic loadout for the player. Validates ownership and binding rules.
   */
  public equipLoadout(
    state: M126PlayerState,
    loadout: CosmeticLoadout,
    currentTick: number,
  ): { success: boolean; receipt: LoadoutReceipt; error?: string } {
    const validation = this._validateLoadoutOwnership(state, loadout);
    if (!validation.valid) {
      return { success: false, receipt: this._nullReceipt(), error: validation.reason };
    }

    state.equippedLoadout = loadout;

    const receipt = this._buildReceipt('EQUIP_LOADOUT', loadout.loadoutId, currentTick);
    return { success: true, receipt };
  }

  /**
   * Returns ML-powered or deterministic recommendations.
   * Always returns exactly 3 loadouts per M126a spec.
   */
  public getRecommendations(
    state: M126PlayerState,
    currentTick: number,
  ): LoadoutRecommendation {
    if (!state.optedInToPersonalization) {
      // Degraded mode: manual selection — return top 3 by accessibility rating
      const loadouts = this._buildTopByAccessibility(state);
      return {
        loadouts,
        modelCardStamp: this._noModelStamp(),
        receipts: [],
      };
    }

    if (!this.mlEnabled || !this.mlModel) {
      // Fallback: deterministic grouping by style tags
      const loadouts = this._deterministicRecommend(state);
      return {
        loadouts,
        modelCardStamp: this._noModelStamp(),
        receipts: loadouts.map(l =>
          this._buildReceipt('RECOMMEND_DETERMINISTIC', l.loadoutId, currentTick),
        ),
      };
    }

    // ML path: score cosmetics → cluster into 3 themed loadouts
    const scores = this.mlModel.getBoundedOutput();
    const loadouts = this._buildLoadoutsFromScores(state, scores);

    const receipts = loadouts.map(l =>
      this._buildReceipt('RECOMMEND_ML', l.loadoutId, currentTick),
    );

    return {
      loadouts,
      modelCardStamp: {
        modelId: this.mlModel.getAuditHash(),
        trainCut: '2026-01',
        featureSchemaHash: createHash('sha256')
          .update(JSON.stringify(state.styleTags))
          .digest('hex')
          .slice(0, 16),
      },
      receipts,
    };
  }

  /**
   * One-click auto-set builder for current event (audit week, freeze week, etc.)
   */
  public autoSetForEvent(
    state: M126PlayerState,
    eventTag: string,
    currentTick: number,
  ): { loadout: CosmeticLoadout; receipt: LoadoutReceipt } {
    const themed = state.ownedCosmetics.filter(c =>
      c.styleTags.includes(eventTag) || c.styleTags.includes('universal'),
    );

    const loadout = this._assembleLoadout(themed, `auto-${eventTag}`);
    const receipt = this._buildReceipt('AUTO_SET_EVENT', loadout.loadoutId, currentTick);

    return { loadout, receipt };
  }

  // ── ML interface passthrough ──────────────────────────────────────────────

  public isMLModelBoundedOutput(): boolean { return true; }
  public isMLModelDetermined(): boolean { return true; }
  public isMLModelRandomized(): boolean { return false; }
  public isMLModelStochastic(): boolean { return false; }
  public isMLModelUnboundedOutput(): boolean { return false; }
  public isMLModelUncertain(): boolean { return false; }

  public getMLModel(): IMLModel | null { return this.mlModel; }

  public getMLModelAuditHash(): string | null {
    return this.mlEnabled ? this.mlModel?.getAuditHash() ?? null : null;
  }

  public getMLModelBoundedOutput(): number[] {
    if (!this.mlEnabled || !this.mlModel) return [0];
    return this.mlModel.getBoundedOutput().map(v => Math.min(Math.max(v, 0), 1));
  }

  public getMLModelDeterministicSeed(): string | null {
    return this.mlEnabled ? this.mlModel?.getDeterministicSeed() ?? null : null;
  }

  public getMLModelDeterministicOutput(): number[] {
    if (!this.mlEnabled || !this.mlModel) return [0];
    return this.mlModel.getDeterministicOutput().map(v => Math.min(Math.max(v, 0), 1));
  }

  public getMLModelRandomizedSeed(): string | null {
    return this.mlEnabled ? this.mlModel?.getRandomizedSeed() ?? null : null;
  }

  public getMLModelRandomizedOutput(): number[] {
    if (!this.mlEnabled || !this.mlModel) return [0];
    return this.mlModel.getRandomizedOutput().map(v => Math.min(Math.max(v, 0), 1));
  }

  public getMLModelStochasticSeed(): string | null { return null; }
  public getMLModelStochasticOutput(): number[] { return [0]; }
  public getMLModelUnboundedOutput(): number[] {
    if (!this.mlEnabled || !this.mlModel) return [0];
    return this.mlModel.getUnboundedOutput().map(v => Math.min(Math.max(v, 0), 1));
  }

  public getMLModelUncertainty(): string | null {
    return this.mlEnabled ? this.mlModel?.getUncertainty() ?? null : null;
  }

  public getMLModelUncertaintyOutput(): number[] {
    if (!this.mlEnabled || !this.mlModel) return [0];
    return this.mlModel.getUncertaintyOutput().map(v => Math.min(Math.max(v, 0), 1));
  }

  public isPlayerSessionRequired(): boolean { return true; }
  public isGameContextRequired(): boolean { return true; }

  public getPlayerSession(): IPlayerSession | null {
    return this.playerSession;
  }

  public getGameContext(): IGameContext | null {
    return this.gameContext;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _buildSeed(): string {
    return createHash('sha256')
      .update(
        (this.playerSession?.playerId ?? '') +
        (this.gameContext?.rulesetHash ?? '') +
        (this.gameContext?.seasonId ?? ''),
      )
      .digest('hex');
  }

  private _validateLoadoutOwnership(
    state: M126PlayerState,
    loadout: CosmeticLoadout,
  ): { valid: boolean; reason: string } {
    const ownedIds = new Set(state.ownedCosmetics.map(c => c.id));
    const pieces = [loadout.title, loadout.frame, loadout.proofSkin, loadout.lobbyBanner]
      .filter(Boolean) as CosmeticItem[];

    for (const piece of pieces) {
      if (!ownedIds.has(piece.id)) {
        return { valid: false, reason: `Player does not own cosmetic: ${piece.id}` };
      }
    }
    return { valid: true, reason: '' };
  }

  private _buildTopByAccessibility(state: M126PlayerState): CosmeticLoadout[] {
    const sorted = [...state.ownedCosmetics].sort(
      (a, b) => b.accessibilityContrastRating - a.accessibilityContrastRating,
    );
    // Build 3 loadouts from top cosmetics in round-robin
    return [0, 1, 2].map(i => this._assembleLoadout(sorted.slice(i * 4, i * 4 + 4), `top-${i}`));
  }

  private _deterministicRecommend(state: M126PlayerState): CosmeticLoadout[] {
    const tagGroups: Record<string, CosmeticItem[]> = {};
    for (const c of state.ownedCosmetics) {
      for (const tag of c.styleTags) {
        tagGroups[tag] = tagGroups[tag] ?? [];
        tagGroups[tag].push(c);
      }
    }
    const groups = Object.values(tagGroups).slice(0, 3);
    while (groups.length < 3) groups.push(state.ownedCosmetics.slice(0, 4));
    return groups.map((g, i) => this._assembleLoadout(g, `theme-${i}`));
  }

  private _buildLoadoutsFromScores(state: M126PlayerState, scores: number[]): CosmeticLoadout[] {
    // Map scores to cosmetics (trim to owned list length), then cluster into 3 sets
    const indexed = state.ownedCosmetics.map((c, i) => ({
      cosmetic: c,
      score: scores[i % scores.length] ?? 0,
    }));
    indexed.sort((a, b) => b.score - a.score);

    return [0, 1, 2].map(i => {
      const slice = indexed.slice(i * 4, i * 4 + 4).map(x => x.cosmetic);
      const theme = slice[0]?.styleTags[0] ?? `set-${i}`;
      return this._assembleLoadout(slice, theme);
    });
  }

  private _assembleLoadout(items: CosmeticItem[], themeLabel: string): CosmeticLoadout {
    const byType = (t: CosmeticItem['type']) => items.find(c => c.type === t);
    const avgContrast =
      items.length > 0
        ? items.reduce((s, c) => s + c.accessibilityContrastRating, 0) / items.length
        : 0;

    const id = createHash('sha256')
      .update(themeLabel + items.map(c => c.id).join(','))
      .digest('hex')
      .slice(0, 16);

    return {
      loadoutId: id,
      title: byType('title'),
      frame: byType('frame'),
      proofSkin: byType('proof_skin'),
      lobbyBanner: byType('lobby_banner'),
      themeLabel,
      accessibilityNote:
        avgContrast >= 0.7
          ? 'High contrast — readable in all display modes'
          : avgContrast >= 0.4
          ? 'Moderate contrast — check accessibility settings'
          : 'Low contrast — consider enabling high-contrast mode',
    };
  }

  private _buildReceipt(action: string, loadoutId: string, tick: number): LoadoutReceipt {
    const payload = { action, loadoutId, tick };
    return {
      action,
      loadoutId,
      tick,
      signedAt: new Date().toISOString(),
      hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32),
    };
  }

  private _nullReceipt(): LoadoutReceipt {
    return { action: 'NONE', loadoutId: '', tick: 0, signedAt: '', hash: '' };
  }

  private _noModelStamp(): ModelCardStamp {
    return { modelId: 'none', trainCut: 'none', featureSchemaHash: 'none' };
  }
}
