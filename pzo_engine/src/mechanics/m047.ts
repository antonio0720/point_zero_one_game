// pzo_engine/src/mechanics/m047.ts

export class M47SignedActionsClientServerIntegrity {
    private readonly mlEnabled: boolean;
    private readonly auditHash: string;

    constructor(mlEnabled: boolean, auditHash: string) {
        this.mlEnabled = mlEnabled;
        this.auditHash = auditHash;
    }

    public getMlEnabled(): boolean {
        return this.mlEnabled;
    }

    public getAuditHash(): string {
        return this.auditHash;
    }
}

export function signAction(action: any): [string, number] {
    if (!this.mlEnabled) {
        throw new Error("ML is not enabled");
    }

    const signedAction = JSON.stringify(action);
    const hash = crypto.createHash('sha256').update(signedAction).digest('hex');
    const auditHash = this.auditHash + hash;

    return [signedAction, 1];
}

export function verifySignedAction(signedAction: string): boolean {
    if (!this.mlEnabled) {
        throw new Error("ML is not enabled");
    }

    try {
        const action = JSON.parse(signedAction);
        const hash = crypto.createHash('sha256').update(JSON.stringify(action)).digest('hex');
        return this.auditHash === hash;
    } catch (error) {
        return false;
    }
}
