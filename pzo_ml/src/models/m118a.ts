// M118a — Clip Remix Chains (ML/DL Companion: Remix Suggestor + Safety Filter)
// source spec: ml/M118a_clip_remix_chains_ml_dl_companion_remix_suggestor_safety_filter.md

export class M118a {
  private readonly _mlEnabled: boolean;
  private readonly _auditHash: string;

  constructor(mlEnabled: boolean, auditHash: string) {
    this._mlEnabled = mlEnabled;
    this._auditHash = auditHash;
  }

  get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  set mlEnabled(value: boolean) {
    if (typeof value !== 'boolean') {
      throw new Error('mlEnabled must be a boolean');
    }
    this._mlEnabled = value;
  }

  get auditHash(): string {
    return this._auditHash;
  }

  set auditHash(value: string) {
    if (typeof value !== 'string') {
      throw new Error('auditHash must be a string');
    }
    this._auditHash = value;
  }

  public suggestRemixes(input: number[]): number[] {
    if (!this.mlEnabled) {
      return [];
    }

    // bounded nudges
    const nudgedInput = input.map((x, i) => Math.max(0, Math.min(x + (i % 2 === 0 ? 1 : -1), 1)));

    // safety filter
    const filteredNudgedInput = nudgedInput.filter((x, i) => x > nudgedInput[i - 1] && x < nudgedInput[i + 1]);

    return filteredNudgedInput;
  }
}
