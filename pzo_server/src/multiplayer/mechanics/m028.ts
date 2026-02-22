// tslint:disable:no-any strict-type-checking no-object-literal-types

export class M28HandshakeWindowsFastNegotiationUI {
    private mlEnabled = false;
    private boundedOutputs = 0.5; // default to 50%
    private auditHash = 'audit_hash_placeholder';

    public getMlEnabled(): boolean {
        return this.mlEnabled;
    }

    public setMlEnabled(value: boolean): void {
        this.mlEnabled = value;
    }

    public getBoundedOutputs(): number {
        return this.boundedOutputs;
    }

    public setBoundedOutputs(value: number): void {
        if (value >= 0 && value <= 1) {
            this.boundedOutputs = value;
        } else {
            throw new Error('bounded_outputs must be between 0 and 1');
        }
    }

    public getAuditHash(): string {
        return this.auditHash;
    }

    public setAuditHash(value: string): void {
        this.auditHash = value;
    }
}

export function isM28HandshakeWindowsFastNegotiationUIEnabled(
    mlEnabled: boolean,
    boundedOutputs: number,
    auditHash: string
): boolean {
    return (
        mlEnabled === M28HandshakeWindowsFastNegotiationUI.prototype.getMlEnabled() &&
        boundedOutputs === M28HandshakeWindowsFastNegotiationUI.prototype.getBoundedOutputs() &&
        auditHash === M28HandshakeWindowsFastNegotiationUI.prototype.getAuditHash()
    );
}
