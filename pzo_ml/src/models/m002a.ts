// pzo_ml/src/models/m002a.ts

export class M02a {
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

    private _boundedNudge(value: number): number {
        if (value < 0) {
            return 0;
        } else if (value > 1) {
            return 1;
        }
        return value;
    }

    public calculateDifficulty(playerProgress: number, timerStress: number): number {
        if (!this._mlEnabled) {
            return playerProgress;
        }

        const boundedNudge = this._boundedNudge(timerStress);
        const difficulty = (playerProgress + boundedNudge) / 2;

        // Preserve determinism by using a hash of the auditHash
        const hashedAuditHash = crypto.createHash('sha256').update(this._auditHash).digest('hex');
        return Math.floor(difficulty * 1000000 + parseInt(hashedAuditHash, 16)) % 1000001;
    }
}
