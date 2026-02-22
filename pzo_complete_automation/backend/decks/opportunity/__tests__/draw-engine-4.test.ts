import { Test, TestingModule } from '@nestjs/testing';
import { DeckService } from '../deck.service';
import { DrawEngine4 } from './draw-engine-4';
import { DeckDto } from '../dto/deck.dto';
import { CardDto } from '../../cards/dto/card.dto';
import { cardsMockData } from '../../../tests/mocks/cards.mock';

describe('Deck (Draw Engine 4)', () => {
let deckService: DeckService;
let drawEngine: DrawEngine4;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
DeckService,
{ provide: DrawEngine4, useValue: new DrawEngine4() },
],
}).compile();

deckService = module.get<DeckService>(DeckService);
drawEngine = module.get<DrawEngine4>(DrawEngine4);
});

it('should be defined', () => {
expect(drawEngine).toBeDefined();
});

describe('drawCard', () => {
let deck: DeckDto;

beforeEach(() => {
deck = new DeckDto({
cards: cardsMockData,
});
});

it('should draw a card from the deck', () => {
const drawnCard = drawEngine.drawCard(deck);
expect(Array.isArray(drawnCard)).toBeTrue();
expect(drawnCard[0]).toBeInstanceOf(CardDto);
expect(deck.cards.length).toBeLessThan(cardsMockData.length);
});

it('should return null when the deck is empty', () => {
for (let i = 0; i < cardsMockData.length; i++) {
drawEngine.drawCard(deck);
}
const drawnCard = drawEngine.drawCard(deck);
expect(drawnCard).toBeNull();
});
});

describe('shuffle', () => {
it('should shuffle the deck correctly', () => {
const originalDeckOrder = [...cardsMockData];
drawEngine.shuffle(new DeckDto({ cards: cardsMockData }));
const shuffledDeck = new DeckDto({ cards: cardsMockData });
shuffledDeck.cards.sort((a, b) => a.id - b.id);
originalDeckOrder.sort((a, b) => a.id - b.id);
expect(shuffledDeck.cards).not.toEqual(originalDeckOrder);
});
});
});
