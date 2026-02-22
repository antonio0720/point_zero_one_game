import { Deck } from "../decks/deck";
import { Card } from "../../cards/card";

describe("Deck", () => {
let deck: Deck;

beforeEach(() => {
deck = new Deck();
});

it("should initialize an empty deck", () => {
expect(deck.cards.length).toBe(0);
});

it("should add a card to the deck", () => {
const card = new Card("Test Suit", "Test Rank");
deck.addCard(card);
expect(deck.cards.length).toBe(1);
expect(deck.cards[0]).toEqual(card);
});

it("should return the top card of the deck", () => {
const card = new Card("Test Suit", "Test Rank");
deck.addCard(card);
deck.draw();
expect(deck.cards.length).toBe(0);
expect(deck.topCard()).toEqual(card);
});

it("should shuffle the deck correctly", () => {
const cards = Array.from({ length: 10 }, (_, i) => new Card(`Suit${i + 1}`, `Rank${i + 1}`));
cards.forEach((card) => deck.addCard(card));
deck.shuffle();
const shuffledCards = [...deck.cards];
expect(shuffledCards).not.toEqual(cards);
});
});
