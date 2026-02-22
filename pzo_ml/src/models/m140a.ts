// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M140a {
    private readonly _mlEnabled: boolean;
    private readonly _auditHash: string;

    constructor(mlEnabled: boolean, auditHash: string) {
        this._mlEnabled = mlEnabled;
        this._auditHash = auditHash;
    }

    public getMlEnabled(): boolean {
        return this._mlEnabled;
    }

    public getAuditHash(): string {
        return this._auditHash;
    }
}

export class RedactionAssistant {
    private readonly _boundedNudges: number;

    constructor(boundedNudges: number) {
        if (boundedNudges < 0 || boundedNudges > 1) {
            throw new Error('Bounded nudges must be between 0 and 1');
        }
        this._boundedNudges = boundedNudges;
    }

    public getBoundedNudges(): number {
        return this._boundedNudges;
    }
}

export class PacketSummarizer {
    private readonly _auditHash: string;

    constructor(auditHash: string) {
        this._auditHash = auditHash;
    }

    public getAuditHash(): string {
        return this._auditHash;
    }
}
