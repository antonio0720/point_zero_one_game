// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M53a {
    private readonly _boundedNudge: number;
    private readonly _auditHash: string;

    constructor(
        boundedNudge: number,
        auditHash: string,
        mlEnabled: boolean = true
    ) {
        this._boundedNudge = boundedNudge;
        this._auditHash = auditHash;
        if (!mlEnabled) {
            throw new Error('ML is disabled');
        }
    }

    public getBoundedNudge(): number {
        return Math.min(Math.max(this._boundedNudge, 0), 1);
    }

    public getAuditHash(): string {
        return this._auditHash;
    }
}

export function createM53a(
    boundedNudge: number,
    auditHash: string,
    mlEnabled: boolean = true
): M53a {
    return new M53a(boundedNudge, auditHash, mlEnabled);
}
