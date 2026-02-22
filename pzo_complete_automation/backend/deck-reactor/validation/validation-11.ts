import { Deck } from "../interfaces";

export function validateDeck(deck: Deck): boolean {
return (
Array.isArray(deck.cards) &&
deck.cards.length > 0 &&
deck.name !== undefined &&
deck.name !== "" &&
typeof deck.name === "string" &&
!Array.from(deck.cards).some((card: any) => {
return (
typeof card !== "object" ||
!("name" in card && typeof card.name === "string") ||
!(typeof card.rank === "number" && card.rank >= 1 && card.rank <= 13) ||
!(typeof card.suit === "string" && card.suit.length === 1 && ['S', 'H', 'D', 'C'].includes(card.suit))
);
})
);
}
