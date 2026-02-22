export class ActionValidator {
    private readonly mlEnabled: boolean;
    private readonly auditHash: string;

    constructor(mlEnabled: boolean, auditHash: string) {
        this.mlEnabled = mlEnabled;
        this.auditHash = auditHash;
    }

    public validate(action: { type: string; card?: number; targetSymbol?: string }): { valid: boolean; reason?: string } {
        if (action.type === 'PLAY_CARD') {
            const card = action.card;
            const energy = 10; // assuming default energy value
            const targetSymbol = action.targetSymbol;

            if (!card) {
                return { valid: false, reason: 'No card selected' };
            }

            if (energy < card) {
                return { valid: false, reason: 'Insufficient energy to play the card' };
            }

            if (!targetSymbol || targetSymbol.length !== 3) {
                return { valid: false, reason: 'Invalid target symbol' };
            }
        } else if (action.type === 'DRAW') {
            // no validation needed for DRAW action
        } else if (action.type === 'PASS') {
            // no validation needed for PASS action
        }

        return { valid: true };
    }
}
