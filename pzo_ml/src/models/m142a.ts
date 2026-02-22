// tslint:disable:no-any strict-type-checking no-empty-interface

export class M142a {
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

export class M142aHouseRules {
    private readonly _boundedNudges: number[];
    private readonly _auditHash: string;

    constructor(boundedNudges: number[], auditHash: string) {
        if (boundedNudges.some(nudge => nudge < 0 || nudge > 1)) {
            throw new Error('Bounded nudges must be between 0 and 1');
        }
        this._boundedNudges = boundedNudges;
        this._auditHash = auditHash;
    }

    public getBoundedNudges(): number[] {
        return this._boundedNudges;
    }

    public getAuditHash(): string {
        return this._auditHash;
    }
}

export class M142aLobbyConfigurationAdvisor {
    private readonly _mlEnabled: boolean;
    private readonly _boundedNudges: number[];
    private readonly _auditHash: string;

    constructor(mlEnabled: boolean, boundedNudges: number[], auditHash: string) {
        this._mlEnabled = mlEnabled;
        this._boundedNudges = boundedNudges;
        this._auditHash = auditHash;
    }

    public getMlEnabled(): boolean {
        return this._mlEnabled;
    }

    public getBoundedNudges(): number[] {
        return this._boundedNudges;
    }

    public getAuditHash(): string {
        return this._auditHash;
    }
}
