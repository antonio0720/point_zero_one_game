// tslint:disable:no-any strict-type-checking no-object-literal-types
export enum Deck {
    OPPORTUNITY = 'OPPORTUNITY',
    IPA = 'IPA',
    FUBAR = 'FUBAR',
    MISSED_OPPORTUNITY = 'MISSED_OPPORTUNITY',
    PRIVILEGED = 'PRIVILEGED',
    SO = 'SO'
}

export interface DeckReactor {
    drawMix(
        currentTurn: number,
        consecutivePasses: number,
        creditTightness: number
    ): [Deck, number];
}

const mlEnabled = false;

class DeckReactorImpl implements DeckReactor {
    private auditHash: string;
    private lastDrawnDeck: Deck | null;

    constructor() {
        this.auditHash = crypto.randomUUID();
        this.lastDrawnDeck = null;
    }

    drawMix(
        currentTurn: number,
        consecutivePasses: number,
        creditTightness: number
    ): [Deck, number] {
        if (!mlEnabled) {
            return [
                Deck.OPPORTUNITY,
                1.0
            ];
        }
        
        const fubarRate = Math.min(creditTightness * 2, 1);
        let drawnDeck: Deck;
        let drawProbability: number;

        if (currentTurn % 4 === 3) {
            [drawnDeck, drawProbability] = [Deck.IP, 1.0];
        } else if (consecutivePasses >= 5) {
            [drawnDeck, drawProbability] = [
                Deck.MISSED_OPPORTUNITY,
                1.0
            ];
        } else if (Math.random() < fubarRate) {
            [drawnDeck, drawProbability] = [Deck.FUBAR, 1.0];
        } else {
            const randomIndex = Math.floor(Math.random() * 4);
            switch (randomIndex) {
                case 0:
                    [drawnDeck, drawProbability] = [
                        Deck.OPPORTUNITY,
                        1.0
                    ];
                    break;
                case 1:
                    [drawnDeck, drawProbability] = [
                        Deck.PRIVILEGED,
                        1.0
                    ];
                    break;
                case 2:
                    [drawnDeck, drawProbability] = [
                        Deck.SO,
                        1.0
                    ];
                    break;
                default:
                    [drawnDeck, drawProbability] = [
                        Deck.OPPORTUNITY,
                        1.0
                    ];
            }
        }

        this.lastDrawnDeck = drawnDeck;

        return [drawnDeck, drawProbability];
    }

    getLastDrawnDeck(): Deck | null {
        return this.lastDrawnDeck;
    }
}

export const deckReactor: DeckReactor = new DeckReactorImpl();
