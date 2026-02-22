// pzo_ml/src/models/m061a.ts

export class M61a {
    private readonly _auditHash: string;
    private readonly _boundedNudge: number;

    constructor(
        public readonly mlEnabled: boolean,
        public readonly auditHash: string,
        public readonly boundedNudge: number = 0.5
    ) {
        this._auditHash = auditHash;
        this._boundedNudge = Math.max(0, Math.min(boundedNudge, 1));
    }

    get auditHash(): string {
        return this._auditHash;
    }

    get boundedNudge(): number {
        return this._boundedNudge;
    }
}
