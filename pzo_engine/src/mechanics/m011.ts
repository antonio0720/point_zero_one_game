// pzo_engine/src/mechanics/m011.ts

export class M11Mechanic {
    private streak = 0;
    private inertiaTax = 0.0;

    public update(streak: number, inertiaTax: number): void {
        this.streak = streak;
        this.inertiaTax = inertiaTax;
    }

    public getStreak(): number {
        return this.streak;
    }

    public getInertiaTax(): number {
        return this.inertiaTax;
    }
}

export class M11MissedOpportunityStreakAndInertiaTax {
    private mlEnabled: boolean;
    private auditHash: string;

    constructor(mlEnabled: boolean, auditHash: string) {
        this.mlEnabled = mlEnabled;
        this.auditHash = auditHash;
    }

    public calculate(streak: number): number {
        if (!this.mlEnabled) {
            return 0.0;
        }

        const boundedStreak = Math.max(0, Math.min(streak, 1));
        const output = (boundedStreak / 1) * 0.5;

        this.auditHash += `${output}`;

        return output;
    }
}
