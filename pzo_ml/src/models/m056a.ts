// tslint:disable:no-any strict-type-checking no-object-literal-types
export class M56a {
    private readonly _mlEnabled: boolean;
    private readonly _auditHash: string;

    constructor(
        public readonly playstyleConsistency: number,
        public readonly hypocrisyTaxAid: number,
        mlEnabled: boolean = true,
        auditHash?: string
    ) {
        this._mlEnabled = mlEnabled;
        this._auditHash = auditHash || crypto.randomUUID();
    }

    get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    set mlEnabled(value: boolean) {
        if (this._mlEnabled !== value) {
            throw new Error('Cannot change ML model enabled state');
        }
    }

    get auditHash(): string {
        return this._auditHash;
    }

    set auditHash(value: string) {
        if (this._auditHash !== value) {
            throw new Error('Audit hash cannot be changed after initialization');
        }
    }

    public readonly boundedNudge = Math.max(0, Math.min(this.playstyleConsistency + this.hypocrisyTaxAid, 1));
}
