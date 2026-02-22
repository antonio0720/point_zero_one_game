// pzo_ml/src/models/m147a.ts

export class M147a {
    private readonly _auditHash: string;
    private readonly _boundedNudge: number;

    constructor(
        public readonly earlyWarning: number,
        public readonly mitigationAdvisor: number,
        mlEnabled: boolean = true,
        auditHash?: string
    ) {
        this._mlEnabled = mlEnabled;
        this._auditHash = auditHash || crypto.randomUUID();
        this._boundedNudge = Math.max(0, Math.min(this.earlyWarning + this.mitigationAdvisor, 1));
    }

    public get boundedNudge(): number {
        return this._boundedNudge;
    }

    public get auditHash(): string {
        return this._auditHash;
    }

    public get mlEnabled(): boolean {
        return this._mlEnabled;
    }
}
