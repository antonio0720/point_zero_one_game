import { User } from './User';
import { Game } from './Game';
import { Bet } from './Bet';

interface ReputationStakes3 {
user: User;
games: Game[];
bets: Bet[];
}

class ReputationStakes3Service {
calculateReputationScore(stakesData: ReputationStakes3): number {
let reputationScore = stakesData.user.reputationScore;

for (const game of stakesData.games) {
const gameBet = stakesData.bets.find((bet) => bet.gameId === game.id);

if (!gameBet) continue;

reputationScore += this.calculateGameReputationScore(game, gameBet);
}

return reputationScore;
}

private calculateGameReputationScore(game: Game, bet: Bet): number {
const gameScore = game.difficulty * (bet.amount / game.entryFee);

if (game.result === bet.outcome) return gameScore;

return -gameScore;
}
}
