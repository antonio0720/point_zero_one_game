// pzo_ml/src/models/m021a.ts

export class M21a {
    private readonly _mlEnabled: boolean;
    private readonly _auditHash: string;

    constructor(mlEnabled: boolean, auditHash: string) {
        this._mlEnabled = mlEnabled;
        this._auditHash = auditHash;
    }

    get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    get auditHash(): string {
        return this._auditHash;
    }
}

export function boundedNudge(input: number): number {
    if (input < 0) {
        return 0;
    } else if (input > 1) {
        return 1;
    } else {
        return input;
    }
}

export class M21aModel implements IM21aModel {
    private readonly _mlEnabled: boolean;

    constructor(mlEnabled: boolean, auditHash: string) {
        this._mlEnabled = mlEnabled;
    }

    get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    get auditHash(): string {
        return 'audit_hash_placeholder';
    }

    async predict(input: number): Promise<number> {
        if (!this.mlEnabled) {
            throw new Error('ML is disabled');
        }
        const output = boundedNudge(input);
        return output;
    }
}

interface IM21aModel {
    mlEnabled: boolean;
    auditHash: string;
    predict(input: number): Promise<number>;
}
