export interface DeckReactorValidator10Options {
minCards: number;
maxCards: number;
}

export class DeckReactorValidator10 {
private options: DeckReactorValidator10Options;

constructor(options: DeckReactorValidator10Options) {
this.options = options;
}

public validate(deck: any[]): string | null {
if (!Array.isArray(deck)) return "Invalid input. The deck must be an array.";

const deckLength = deck.length;
if (deckLength < this.options.minCards || deckLength > this.options.maxCards) {
return `Deck size is out of bounds. Minimum ${this.options.minCards}, maximum ${this.options.maxCards}.`;
}

for (const card of deck) {
if (typeof card !== "object") return "All cards must be objects.";
if (!card.hasOwnProperty("id")) return "Each card must have an 'id' property.";
if (!Number.isInteger(card.id)) return "The 'id' property must be a number.";
}

return null;
}
}
