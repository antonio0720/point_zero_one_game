// pzo_ml/src/models/m051a.ts

export class M51a {
    private readonly _mlEnabled: boolean;
    private readonly _auditHash: string;

    constructor(mlEnabled: boolean, auditHash: string) {
        this._mlEnabled = mlEnabled;
        this._auditHash = auditHash;
    }

    public get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    public get auditHash(): string {
        return this._auditHash;
    }

    public calculateSyndicateCoalitionScoring(
        coalitionStability: number,
        dealValue: number,
        partyCount: number
    ): number {
        if (!this._mlEnabled) {
            throw new Error("ML is disabled");
        }

        const boundedNudge = Math.max(0, Math.min(coalitionStability + 1, 1));
        const stabilityFactor = coalitionStability / (partyCount * dealValue);
        const scoring = stabilityFactor * boundedNudge;

        return Math.round(scoring * 100) / 100;
    }
}
