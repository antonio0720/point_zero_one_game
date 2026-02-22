// tslint:disable:no-any strict-type-checking

export class M111a {
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

export class M111aPortfolioRulesMacros {
    private readonly _boundedNudges: number[];
    private readonly _safetyVerifier: number[];

    constructor(boundedNudges: number[], safetyVerifier: number[]) {
        if (this._mlEnabled) {
            this._boundedNudges = boundedNudges.map((nudge) => Math.max(0, Math.min(nudge, 1)));
            this._safetyVerifier = safetyVerifier.map((verifier) => Math.max(0, Math.min(verifier, 1)));
        } else {
            this._boundedNudges = boundedNudges;
            this._safetyVerifier = safetyVerifier;
        }
    }

    public get boundedNudges(): number[] {
        return this._boundedNudges;
    }

    public get safetyVerifier(): number[] {
        return this._safetyVerifier;
    }
}

export class M111aMacroSynth {
    private readonly _mlEnabled: boolean;

    constructor(mlEnabled: boolean) {
        this._mlEnabled = mlEnabled;
    }

    public get mlEnabled(): boolean {
        return this._mlEnabled;
    }
}
