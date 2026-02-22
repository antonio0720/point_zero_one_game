// pzo_engine/src/mechanics/m004.ts

export class DeckReactor {
    private deck: number[];
    private drawMixingEnabled: boolean;
    private mlModel: any;

    constructor(deck: number[], drawMixingEnabled: boolean, mlModel?: any) {
        this.deck = deck;
        this.drawMixingEnabled = drawMixingEnabled;
        this.mlModel = mlModel || null;
    }

    public getDeck(): number[] {
        return this.deck.slice();
    }

    public setDeck(deck: number[]): void {
        this.deck = deck;
    }

    public isDrawMixingEnabled(): boolean {
        return this.drawMixingEnabled;
    }

    public setDrawMixingEnabled(drawMixingEnabled: boolean): void {
        this.drawMixingEnabled = drawMixingEnabled;
    }

    public getMlModel(): any {
        return this.mlModel;
    }

    public setMlModel(mlModel: any): void {
        this.mlModel = mlModel;
    }

    public dynamicDrawMixing(drawAmount: number, auditHash: string): number[] {
        if (!this.drawMixingEnabled) {
            throw new Error("Dynamic draw mixing is not enabled");
        }

        const output = this.mlModel ? this.mlModel.predict(drawAmount, auditHash) : Math.random();

        if (output < 0 || output > 1) {
            throw new Error(`Invalid output from ML model: ${output}`);
        }

        const mixedDeck = this.deck.slice();
        for (let i = 0; i < drawAmount; i++) {
            const index = Math.floor(Math.random() * mixedDeck.length);
            const card = mixedDeck.splice(index, 1)[0];
            if (Math.random() < output) {
                // Add the drawn card to the top of the deck
                mixedDeck.unshift(card);
            } else {
                // Add the drawn card to the bottom of the deck
                mixedDeck.push(card);
            }
        }

        return mixedDeck;
    }
}

export function isMlEnabled(): boolean {
    return true; // Replace with actual ML model availability logic
}
