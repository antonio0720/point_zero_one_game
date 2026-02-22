import { MechanicsIngestion8 } from '../src/mechanics-ingestion-8';
import { ICardData, Deck } from '../src/interfaces';
import { expect } from 'chai';

describe('Mechanics Ingestion 8', () => {
let mechanicsIngestion: MechanicsIngestion8;

beforeEach(() => {
mechanicsIngestion = new MechanicsIngestion8();
});

it('should process a card correctly', () => {
const cardData: ICardData = {
// Provide a sample card data here
};
const deck: Deck = { cards: [cardData] };
mechanicsIngestion.ingest(deck);
// Add assertions for the processed card here
});

it('should handle multiple cards correctly', () => {
const card1Data: ICardData = {
// Provide a sample card data 1 here
};
const card2Data: ICardData = {
// Provide a sample card data 2 here
};
const deck: Deck = { cards: [card1Data, card2Data] };
mechanicsIngestion.ingest(deck);
// Add assertions for the processed cards here
});
});
