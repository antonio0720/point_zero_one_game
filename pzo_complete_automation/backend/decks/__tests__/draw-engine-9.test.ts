import { Deck } from '../deck';
import { Card } from '../../card';
import { DrawEngine9 } from './draw-engine-9';

describe('Draw Engine 9', () => {
let deck: Deck;
let drawEngine: DrawEngine9;

beforeEach(() => {
deck = new Deck();
deck.shuffle();
drawEngine = new DrawEngine9();
});

test('should draw cards correctly', () => {
const drawnCards = Array.from({ length: 3 }, () => drawEngine.drawCard(deck));
const expectedCards = [
// Add the expected card order for the first three draws here
];
expect(drawnCards).toEqual(expectedCards);
});

test('should return null when no more cards to draw', () => {
while (deck.size > 0) {
drawEngine.drawCard(deck);
}
const drawnCard = drawEngine.drawCard(deck);
expect(drawnCard).toBeNull();
});
});
