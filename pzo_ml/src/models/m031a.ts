// pzo_ml/src/models/m031a.ts

export class M31a {
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

    public synergyDiscoveryEngine(
        balance: number,
        miningReward: number,
        currentBalanceWatch: number,
        comboMiningThreshold: number
    ): [number, number] | null {

        if (!this.mlEnabled) {
            return null;
        }

        const boundedNudge = Math.min(Math.max(balance + miningReward - currentBalanceWatch, 0), 1);

        if (boundedNudge >= comboMiningThreshold) {
            return [
                balance + miningReward,
                currentBalanceWatch + boundedNudge
            ];
        } else {
            return null;
        }
    }
}
