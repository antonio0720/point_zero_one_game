interface Card {
suit: string;
rank: number;
}

enum PlayerAction {
Draw = 'draw',
Discard = 'discard'
}

interface Player {
hand: Card[];
score: number;
}

class Deck {
private cards: Card[] = [];

constructor() {
for (let suit of ['Spades', 'Hearts', 'Diamonds', 'Clubs']) {
for (let rank = 1; rank <= 13; rank++) {
this.cards.push({ suit, rank });
}
}

this.shuffle();
}

private shuffle(): void {
for (let i = this.cards.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
}
}

public drawCard(): Card | null {
if (this.cards.length === 0) return null;
return this.cards.pop();
}
}

class GameEngine {
private deck: Deck = new Deck();
private players: Player[] = [];

constructor(numPlayers: number, initialCardsPerPlayer: number) {
for (let i = 0; i < numPlayers; i++) {
this.players.push({ hand: [], score: 0 });
}

this.dealCards(initialCardsPerPlayer);
}

private dealCards(cardsPerPlayer: number): void {
for (let player of this.players) {
for (let i = 0; i < cardsPerPlayer; i++) {
const card = this.deck.drawCard();
if (!card) throw new Error('Not enough cards');
player.hand.push(card);
}
}
}

private getWinner(): Player | null {
let highestScorePlayer: Player | null = null;
let highestScore = -1;

for (const player of this.players) {
if (player.score > highestScore) {
highestScorePlayer = player;
highestScore = player.score;
}
}

return highestScorePlayer;
}

private playRound(): Player | null {
let currentPlayerIndex = 0;
const roundCards: Card[] = [];

while (roundCards.length < this.players.length) {
const player = this.players[currentPlayerIndex];

if (player.hand.length === 0) {
return null; // Game over, no more cards for this player
}

console.log(`Player ${currentPlayerIndex + 1}:`, player);
const action = prompt(
`Choose an action [draw/discard]: ${JSON.stringify(player.hand)}`
) as PlayerAction;

if (action === PlayerAction.Draw) {
const card = this.deck.drawCard();
if (!card) throw new Error('Not enough cards');
player.hand.push(card);
} else if (action === PlayerAction.Discard) {
if (roundCards.length > 0) {
roundCards.pop();
} else {
roundCards.unshift(player.hand.pop()!);
}
} else {
console.error('Invalid action');
continue;
}

currentPlayerIndex = (currentPlayerIndex + 1) % this.players.length;
}

// Calculate scores and find the winner of the round
for (const player of this.players) {
let score = 0;
for (const card of player.hand) {
if (card.suit === 'Spades' || player.score === 0) {
score += card.rank;
} else if (card.rank === 11 && card.suit === player.hand[0].suit) {
score += 10;
}
}
player.score = score;
}

const winner = this.getWinner();
if (!winner) return null; // Game not over, no winner yet

console.log('Round Winner:', winner);
roundCards.forEach((card) => {
winner.hand.push(card);
});

return winner;
}

public playGame(): void {
while (true) {
const winner = this.playRound();
if (!winner) break;

console.log(`Player ${this.players.indexOf(winner) + 1} wins the game!`);
}
}
}

const engine = new GameEngine(4, 3);
engine.playGame();
