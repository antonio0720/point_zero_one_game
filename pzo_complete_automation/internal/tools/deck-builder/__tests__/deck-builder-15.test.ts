import { expect } from 'chai';
import * as sinon from 'sinon';
import DeckBuilder from '../../src/deck-builder';
import Card from '../../src/card';
import Suit from '../../src/suit';
import Rank from '../../src/rank';

describe('Deck Builder', () => {
let deckBuilder: DeckBuilder;
let createSpy: sinon.SinonSpy;
let shuffleSpy: sinon.SinonSpy;

beforeEach(() => {
deckBuilder = new DeckBuilder();
createDeckSpy = sinon.spy(deckBuilder, 'createDeck');
shuffleSpy = sinon.spy(Array.prototype, 'shuffle');
});

afterEach(() => {
sinon.restore();
});

it('should create a standard deck', () => {
const suits = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
const ranks = [Rank.ACE, Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING];

deckBuilder.buildStandard();
expect(createDeckSpy.calledOnce).to.be.true;
const createdDeck = createDeckSpy.getCall(0).args[0];

suits.forEach((suit) => {
ranks.forEach((rank) => {
const card = createdDeck.find((card) => card.suit === suit && card.rank === rank);
expect(card).not.to.be.null;
});
});
});

it('should shuffle the deck after creation', () => {
deckBuilder.buildStandard();
expect(shuffleSpy.calledOnce).to.be.true;
});

it('should create a custom deck', () => {
const suits = [Suit.HEARTS, Suit.DIAMONDS];
const ranks = [Rank.ACE, Rank.TWO, Rank.THREE];
const customDeck = deckBuilder.buildCustom([{ suit: Suit.HEARTS, rank: Rank.ACE }, { suit: Suit.DIAMONDS, rank: Rank.TWO }, { suit: Suit.CLUBS, rank: Rank.THREE }]);

expect(createDeckSpy.calledOnce).to.be.true;
const createdDeck = createDeckSpy.getCall(0).args[0];

suits.forEach((suit) => {
ranks.forEach((rank) => {
const card = createdDeck.find((card) => card.suit === suit && card.rank === rank);
expect(card).not.to.be.null;
});
});

expect(customDeck.length).to.equal(createdDeck.length);
});

it('should not include duplicate cards in a custom deck', () => {
const suits = [Suit.HEARTS, Suit.DIAMONDS];
const ranks = [Rank.ACE];
const customDeck = deckBuilder.buildCustom(suits.map((suit) => ({ suit, rank: Rank.ACE })).concat(suits.map((suit) => ({ suit, rank: Rank.TWO }))));

const createdDeck = createDeckSpy.getCall(0).args[0];

suits.forEach((suit) => {
ranks.forEach((rank) => {
const card1 = createdDeck.find((card) => card.suit === suit && card.rank === rank);
const card2 = customDeck.find((card) => card.suit === suit && card.rank === rank);

expect(card1).not.to.be.null;
expect(card2).not.to.be.null;
expect(card1).not.to.equal(card2);
});
});
});
});
