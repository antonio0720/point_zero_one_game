// pzo_ml/src/models/m099a.ts

export class M99a {
    private readonly _auditHash: string;
    private readonly _mlEnabled: boolean;

    constructor(auditHash: string, mlEnabled: boolean) {
        this._auditHash = auditHash;
        this._mlEnabled = mlEnabled;
    }

    public getAuditHash(): string {
        return this._auditHash;
    }

    public isMlEnabled(): boolean {
        return this._mlEnabled;
    }

    private _boundedNudge(value: number): number {
        if (value < 0) {
            return 0;
        } else if (value > 1) {
            return 1;
        }
        return value;
    }

    public optimizeChallengePlacement(
        currentChallengeId: string,
        newChallengeId: string,
        playerProgress: number
    ): { newChallengeId: string; nudge: number } | null {
        if (!this._mlEnabled) {
            return null;
        }

        const boundedPlayerProgress = this._boundedNudge(playerProgress);
        const challengeProbability = 0.5 + (boundedPlayerProgress * 0.2);

        if (Math.random() < challengeProbability) {
            return { newChallengeId, nudge: this._boundedNudge(Math.random()) };
        }

        return null;
    }
}
