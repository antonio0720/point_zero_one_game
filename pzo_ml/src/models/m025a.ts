// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M25a {
    private readonly _boundedNudge: number;
    private readonly _auditHash: string;

    constructor(
        public readonly skillSignal: number,
        public readonly experiment: number,
        boundedNudge: number = 0.5,
        auditHash: string = 'default_audit_hash',
        mlEnabled: boolean = true
    ) {
        this._boundedNudge = boundedNudge;
        this._auditHash = auditHash;

        if (mlEnabled) {
            // Perform some ML-related initialization here...
        }
    }

    get boundedNudge(): number {
        return Math.max(0, Math.min(this._boundedNudge, 1));
    }

    get auditHash(): string {
        return this._auditHash;
    }

    get mlEnabled(): boolean {
        return true; // Always enabled for now
    }
}
