// pzo_ml/src/models/m114a.ts

export class M114a {
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

    public predictReactionTime(input: number[]): number | null {
        if (!this._mlEnabled) {
            return null;
        }

        const reactionTime = this._boundedNudge(this._windowPredictor(input));
        return reactionTime;
    }

    private _windowPredictor(input: number[]): number {
        // implementation of the window predictor model
        // for demonstration purposes, a simple linear regression is used
        const x = input[0];
        const y = input[1];

        if (x === 0) {
            return 0;
        }

        const slope = 2.5; // example slope value
        const intercept = -3.7; // example intercept value

        const predictedValue = slope * x + intercept;

        return this._boundedNudge(predictedValue);
    }
}
