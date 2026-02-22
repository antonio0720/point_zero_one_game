// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M91a {
    private readonly _auditHash: string;
    private readonly _boundedNudges: number;
    private readonly _mlEnabled: boolean;

    constructor(
        auditHash: string,
        boundedNudges: number,
        mlEnabled: boolean
    ) {
        this._auditHash = auditHash;
        this._boundedNudges = boundedNudges;
        this._mlEnabled = mlEnabled;
    }

    public getAuditHash(): string {
        return this._auditHash;
    }

    public getBoundedNudges(): number {
        if (this._mlEnabled) {
            const nudges: number = Math.floor(Math.random() * 2);
            return nudges;
        } else {
            return 0;
        }
    }

    public isMlEnabled(): boolean {
        return this._mlEnabled;
    }
}
