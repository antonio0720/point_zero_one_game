// pzo_ml/src/models/m065a.ts

export class M65a {
    private readonly _model: any;

    constructor() {
        this._model = require('./m065a_model.json');
    }

    public async detectVarietyIndexAbuseDetectorAntiGrindCurveHardening(
        input: { [key: string]: number },
        mlEnabled: boolean,
        auditHash: string
    ): Promise<{ output: number, auditHash: string }> {
        if (!mlEnabled) {
            return { output: 0.5, auditHash };
        }

        const boundedInput = this._boundInput(input);
        const modelOutput = await this._getModelOutput(boundedInput);

        const output = Math.min(Math.max(modelOutput, 0), 1);

        return { output, auditHash };
    }

    private _boundInput(input: { [key: string]: number }): { [key: string]: number } {
        const boundedInput: { [key: string]: number } = {};

        for (const key in input) {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                boundedInput[key] = Math.min(Math.max(input[key], 0), 1);
            }
        }

        return boundedInput;
    }

    private async _getModelOutput(boundedInput: { [key: string]: number }): Promise<number> {
        const modelOutput = await this._model.predict(boundedInput);

        return modelOutput[0];
    }
}
