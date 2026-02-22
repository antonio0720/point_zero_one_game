// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

export class M143TablePenalties {
    private mlEnabled = false;
    private auditHash: string;

    constructor(auditHash: string) {
        this.auditHash = auditHash;
    }

    public getAuditHash(): string {
        return this.auditHash;
    }

    public isMLModelUsed(): boolean {
        return this.mlEnabled;
    }

    public calculatePenalty(
        playerHealth: number,
        playerToxicityLevel: number,
        tablePenalties: { [key: string]: number },
        mlOutput: number
    ): number {
        if (this.mlEnabled) {
            const boundedMLOutput = Math.max(0, Math.min(mlOutput, 1));
            return boundedMLOutput * tablePenalties['toxicity'];
        } else {
            return playerToxicityLevel * tablePenalties['toxicity'];
        }
    }

    public setMLModelEnabled(enabled: boolean): void {
        this.mlEnabled = enabled;
    }
}
