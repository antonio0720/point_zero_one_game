// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M150a {
    private readonly _mlEnabled: boolean;
    private readonly _auditHash: string;

    constructor(
        public readonly verifierAssistant: VerifierAssistant,
        public readonly finalCardComposer: FinalCardComposer,
        mlEnabled: boolean = true
    ) {
        this._mlEnabled = mlEnabled;
        this._auditHash = crypto.createHash('sha256').update(JSON.stringify({})).digest('hex');
    }

    get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    set mlEnabled(value: boolean) {
        this._mlEnabled = value;
    }

    get auditHash(): string {
        return this._auditHash;
    }
}

export class VerifierAssistant {
    private readonly _boundedNudges: number;

    constructor(
        public readonly finalityCeremonyId: string,
        boundedNudges: number = 0
    ) {
        if (boundedNudges < 0 || boundedNudges > 1) {
            throw new Error('Bounded nudges must be between 0 and 1');
        }
        this._boundedNudges = boundedNudges;
    }

    get boundedNudges(): number {
        return this._boundedNudges;
    }
}

export class FinalCardComposer {
    private readonly _auditHash: string;

    constructor(
        public readonly finalityCeremonyId: string,
        auditHash: string
    ) {
        if (typeof auditHash !== 'string') {
            throw new Error('Audit hash must be a string');
        }
        this._auditHash = auditHash;
    }

    get auditHash(): string {
        return this._auditHash;
    }
}
