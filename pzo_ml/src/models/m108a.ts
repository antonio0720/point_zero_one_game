// pzo_ml/src/models/m108a.ts

export class M108a {
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

    public partialFills(
        price: number,
        quantity: number,
        fillProbability: number
    ): [number, number] | null {
        if (!this.mlEnabled) {
            return null;
        }

        const boundedFillProbability = Math.max(0, Math.min(fillProbability, 1));
        const boundedQuantity = Math.max(0, Math.min(quantity, 100));

        const fillAmount = boundedQuantity * boundedFillProbability;

        return [fillAmount, price];
    }
}
