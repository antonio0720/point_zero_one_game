import { Random } from 'meteor/random';

interface GameRound {
players: number[];
scores: number[];
}

function stressTest(numRounds: number, numPlayersPerRound: number): { averageScore: number; standardDeviation: number } {
const rounds: GameRound[] = [];
let totalScore = 0;

for (let roundIndex = 0; roundIndex < numRounds; roundIndex++) {
const players = Array.from({ length: numPlayersPerRound }, () => Random.id());
const scores: number[] = players.map(() => rollDice(10));
totalScore += scores.reduce((sum, score) => sum + score, 0);
rounds.push({ players, scores });
}

const averageScore = totalScore / numRounds;
let varianceSum = 0;

for (const round of rounds) {
const roundVariance = round.scores.reduce(
(sum, score) => sum + Math.pow(score - averageScore, 2),
0
);
varianceSum += roundVariance;
}

const standardDeviation = Math.sqrt(varianceSum / numRounds);

return { averageScore, standardDeviation };
}

function rollDice(numSides: number): number {
return Math.floor(Math.random() * numSides) + 1;
}
