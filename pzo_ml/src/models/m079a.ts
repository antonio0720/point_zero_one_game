// pzo_ml/src/models/m079a.ts

export class M79a {
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

    public calculateSuccessProbability(
        coordination: number,
        sandbaggingGuard: number
    ): number {
        if (!this.mlEnabled) {
            throw new Error("ML is not enabled");
        }

        const boundedCoordination = Math.max(0, Math.min(coordination, 1));
        const boundedSandbaggingGuard = Math.max(0, Math.min(sandbaggingGuard, 1));

        const probability =
            (boundedCoordination + boundedSandbaggingGuard) / 2;

        return Math.min(Math.max(probability, 0), 1);
    }
}
