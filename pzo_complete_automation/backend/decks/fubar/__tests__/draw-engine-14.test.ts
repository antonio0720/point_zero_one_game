import { DrawEngine14 } from "../draw-engine-14";
import { Deck } from "../../deck";
import { Card } from "../../card";

jest.mock("../../card");

describe("Draw Engine 14", () => {
let drawEngine: DrawEngine14;
let deck: Deck;

beforeEach(() => {
Card.mockImplementationOnce((id) => new Card(id));
deck = new Deck();
deck.cards = Array.from({ length: 52 }, (_, i) => deck.addCard(i + 1));
drawEngine = new DrawEngine14(deck);
});

test("draw one card", () => {
const card = drawEngine.draw();
expect(card).toEqual(expect.any(Card));
});

test("draw multiple cards", () => {
const cardsDrawn = [...Array(5)].map(() => drawEngine.draw());
expect(cardsDrawn).every((card) => expect(card).toEqual(expect.any(Card)));
});

test("draw from an empty deck should throw error", () => {
expect(() => {
while (drawEngine.deck.length > 0) drawEngine.draw();
drawEngine.draw();
}).toThrow("No more cards in the deck");
});
});
