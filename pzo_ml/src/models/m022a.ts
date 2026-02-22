// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M22a {
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

    public classify(input: number): [number, number] {
        if (!this.mlEnabled) {
            throw new Error('ML is disabled');
        }
        
        const output = Math.min(Math.max(0.5 * input + 0.2, 0), 1);
        return [output, this._auditHash];
    }
}

export function boundedNudge(value: number): number {
    if (value < 0) {
        return 0;
    } else if (value > 1) {
        return 1;
    } else {
        return value;
    }
}
