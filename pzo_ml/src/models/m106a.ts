// tslint:disable:no-any strict-type-checking
export class M106a {
    private readonly _auditHash: string;
    private readonly _boundedNudge: number;
    private readonly _mlEnabled: boolean;

    constructor(
        public readonly assetCondition: number,
        public readonly failurePredictorOutput: number,
        public readonly maintenancePlannerOutput: number,
        auditHash: string,
        boundedNudge: number,
        mlEnabled: boolean
    ) {
        this._auditHash = auditHash;
        this._boundedNudge = boundedNudge;
        this._mlEnabled = mlEnabled;

        if (this.assetCondition < 0 || this.assetCondition > 1) {
            throw new Error('Asset condition must be between 0 and 1');
        }

        if (this.failurePredictorOutput < 0 || this.failurePredictorOutput > 1) {
            throw new Error('Failure predictor output must be between 0 and 1');
        }

        if (this.maintenancePlannerOutput < 0 || this.maintenancePlannerOutput > 1) {
            throw new Error('Maintenance planner output must be between 0 and 1');
        }
    }

    public get auditHash(): string {
        return this._auditHash;
    }

    public get boundedNudge(): number {
        return this._boundedNudge;
    }

    public get mlEnabled(): boolean {
        return this._mlEnabled;
    }
}
