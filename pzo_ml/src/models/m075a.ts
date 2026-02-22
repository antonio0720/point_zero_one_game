// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M75a {
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

    public generateIntegrityDigest(input: number[]): number[] {
        if (!this._mlEnabled) {
            throw new Error('ML is disabled');
        }

        const boundedInput = input.map((x, i) => Math.max(0, Math.min(x, 1)));

        // ... (rest of the implementation)
    }
}
