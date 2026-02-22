class Card {
value: string;
constructor(value: string) {
this.value = value;
}
}

interface Deck {
shuffle(): void;
drawCard(): Card | null;
remainingCardsCount(): number;
}

class Deck implements Deck {
private cards: Array<Card>;
private currentIndex: number;

constructor(initialCards: Array<Card>) {
this.cards = initialCards;
this.currentIndex = -1;
}

public shuffle(): void {
for (let i = this.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
}
this.currentIndex = -1;
}

public drawCard(): Card | null {
if (this.remainingCardsCount() === 0) return null;
this.currentIndex++;
return this.cards[this.currentIndex];
}

public remainingCardsCount(): number {
return this.cards.length - this.currentIndex - 1;
}
}
