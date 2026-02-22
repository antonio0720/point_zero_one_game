import { Deck } from './deck';
import { Tensor } from '@tensorflow/tfjs';

interface WinProbabilityPrediction {
winProbability: number;
}

async function predictWinProbability(deck: Deck, model: any): Promise<WinProbabilityPrediction> {
const cardIds = deck.getCardsIds();
const input = Tensor.from(cardIds);
const prediction = await model.predict(input);
return { winProbability: prediction.dataSync()[0] };
}

async function balanceDeck(deck: Deck, model: any): Promise<void> {
let totalWinProbability = 0;
const cardCounts = deck.getCardCounts();

for (const [cardId, count] of Object.entries(cardCounts)) {
const predictions = Array.from({ length: count }, () => predictWinProbability(new Deck([cardId]), model));
totalWinProbability += predictions.reduce((sum, { winProbability }) => sum + winProbability * count, 0);
}

const averageWinProbability = totalWinProbability / deck.getTotalCardCount();

for (const [cardId, count] of Object.entries(cardCounts)) {
const predictions = Array.from({ length: count }, () => predictWinProbability(new Deck([cardId]), model));
const winProbabilitySum = predictions.reduce((sum, { winProbability }) => sum + winProbability, 0);
const adjustedCount = Math.round((averageWinProbability / winProbabilitySum) * count);
deck.setCardCount(cardId, adjustedCount);
}
}
