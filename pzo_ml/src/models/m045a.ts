// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M45a {
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
