export class M04aDeckReactorRlPolicy extends MLBase {
    private _mlEnabled = false;

    public get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    public set mlEnabled(value: boolean) {
        this._mlEnabled = value;
    }

    public async evaluate(inputs: { creditTightness: number, consecutivePasses: number, tickIndex: number, momentDeficit: number }): Promise<{ drawWeights: [number, number], recommendation: string, audit_hash: string }> {
        if (!this.mlEnabled) return null;

        const { creditTightness, consecutivePasses, tickIndex, momentDeficit } = inputs;
        const drawWeights = this._calculateDrawWeights(creditTightness, consecutivePasses, tickIndex, momentDeficit);
        const recommendation = this._getRecommendation(drawWeights);
        const audit_hash = crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex');

        return { drawWeights, recommendation, audit_hash };
    }

    private _calculateDrawWeights(creditTightness: number, consecutivePasses: number, tickIndex: number, momentDeficit: number): [number, number] {
        const fubarMax = 0.4;
        const opportunityMin = 0.3;

        // constrained contextual bandit
        const drawWeightFubar = Math.min(Math.max(creditTightness * (1 - consecutivePasses / 10), opportunityMin), fubarMax);
        const drawWeightOpportunity = Math.min(Math.max((1 - creditTightness) * (consecutivePasses / 10), opportunityMin), fubarMax);

        return [drawWeightFubar, drawWeightOpportunity];
    }

    private _getRecommendation(drawWeights: [number, number]): string {
        if (drawWeights[0] > drawWeights[1]) return 'Draw FUBAR';
        else if (drawWeights[0] < drawWeights[1]) return 'Draw OPPORTUNITY';
        else return 'No Draw';
    }
}
