interface GameState {
player1: Player;
player2: Player;
currentTurn: number;
}

class Player {
health: number;
attackPower: number;
defensePower: number;

constructor(health = 100, attackPower = 10, defensePower = 5) {
this.health = health;
this.attackPower = attackPower;
this.defensePower = defensePower;
}
}

const gameEngine = (state: GameState): GameState => {
const { player1, player2, currentTurn } = state;
const nextTurn = (currentTurn + 1) % 2;

if (nextTurn === 0) {
player1.defensePower -= Math.floor(player2.attackPower / 2);
player2.health -= player1.attackPower * player2.defensePower;

if (player2.health <= 0) {
return { ...state, winner: player1 };
}
} else {
player2.defensePower -= Math.floor(player1.attackPower / 2);
player1.health -= player2.attackPower * player1.defensePower;

if (player1.health <= 0) {
return { ...state, winner: player2 };
}
}

return { ...state, currentTurn: nextTurn };
};
