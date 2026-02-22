import { DeckBuilder } from '../deck-builder';
import { Card, CardType, Deck, Player } from '../models';

const deckBuilder = new DeckBuilder();

// Create a new deck with 30 cards (20 basic and 10 advanced)
const deck: Deck = deckBuilder.createDeck(30);

// Define some card types for the operation
const basicCardTypes = [CardType.Action, CardType.Treasure];
const advancedCardTypes = [CardType.Victory, CardType.Action, CardType.Treasure];

// Add basic cards to the deck (20 in total)
for (let i = 0; i < 20; i++) {
const randomBasicCardType = Math.random() < 0.5 ? basicCardTypes[0] : basicCardTypes[1];
const card: Card = new Card(randomBasicCardType);
deckBuilder.addCardToDeck(deck, card);
}

// Add advanced cards to the deck (10 in total)
for (let i = 0; i < 10; i++) {
const randomAdvancedCardType = Math.random() < 0.5 ? advancedCardTypes[0] : advancedCardTypes[1];
const card: Card = new Card(randomAdvancedCardType);
deckBuilder.addCardToDeck(deck, card);
}

// Shuffle the deck and create a player with the shuffled deck
const player = new Player('Player 1');
deckBuilder.shuffleDeck(deck);
player.setDeck(deck);

// Print the player's hand (5 cards)
console.log(`Player 1's starting hand:`);
for (let i = 0; i < 5; i++) {
console.log(player.getHand()[i].getName());
}
