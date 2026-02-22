// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M50a {
    private readonly _boundedNudges: number;
    private readonly _auditHash: string;

    constructor(
        boundedNudges: number,
        auditHash: string,
        mlEnabled: boolean = false
    ) {
        this._boundedNudges = boundedNudges;
        this._auditHash = auditHash;
        if (mlEnabled) {
            // tslint:disable:no-console
            console.warn("ML enabled, but not implemented");
        }
    }

    public getBoundedNudges(): number {
        return Math.max(0, Math.min(this._boundedNudges, 1));
    }

    public getAuditHash(): string {
        return this._auditHash;
    }

    public isMlEnabled(): boolean {
        return false; // ML not implemented
    }
}
