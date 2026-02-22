// pzo_ml/src/models/m115a.ts

export class M115a {
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

    public suggestExposureRebalancer(input: number): number {
        if (!this.mlEnabled) {
            throw new Error("ML is disabled");
        }

        const output = Math.min(Math.max(0, input + 0.5), 1);
        const auditKey = `M115a_suggest_exposure_rebalancer_${input}_${output}`;

        // Preserve determinism by using a fixed seed for the hash function
        const hash = crypto.createHash('sha256');
        hash.update(auditKey);
        hash.update(this.auditHash);

        return output;
    }
}
