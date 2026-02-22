// tslint:disable:no-any strict-type-checking
export class M139a {
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

export class M139aOfflineQueueRuns {
    private readonly _boundedNudges: number[];
    private readonly _mlModel: M139a;

    constructor(boundedNudges: number[], mlModel: M139a) {
        if (boundedNudges.length === 0 || boundedNudges.some(nudge => nudge < 0 || nudge > 1)) {
            throw new Error('Bounded nudges must be between 0 and 1');
        }
        this._boundedNudges = boundedNudges;
        this._mlModel = mlModel;
    }

    public getBoundedNudges(): number[] {
        return this._boundedNudges;
    }

    public getMlModel(): M139a {
        return this._mlModel;
    }
}

export class M139aOfflineQueueRunsResult {
    private readonly _result: boolean;

    constructor(result: boolean) {
        if (typeof result !== 'boolean') {
            throw new Error('Result must be a boolean');
        }
        this._result = result;
    }

    public getResult(): boolean {
        return this._result;
    }
}
