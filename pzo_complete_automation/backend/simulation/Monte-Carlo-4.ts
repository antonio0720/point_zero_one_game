interface Game {
getValidMoves(state: number[]): number[];
makeMove(state: number[], move: number): number[];
isGameOver(state: number[]): boolean;
winner(state: number[]): number | null;
}

function monteCarloSimulation(game: Game, state: number[], depth: number, alpha: number, beta: number, temperature: number) {
if (depth === 0 || game.isGameOver(state)) return game.score(state);

const validMoves = game.getValidMoves(state);
const simulatedScores = validMoves.map((move) => {
const childState = game.makeMove(state, move);
let simScore = monteCarloSimulation(game, childState, depth - 1, alpha, beta, temperature * 0.99);
simScore += Math.random() >= temperature ? simScore : -simScore; // Temperature annealing
return simScore;
});

const avgSimulatedScores = simulatedScores.reduce((a, b) => a + b, 0) / simulatedScores.length;
const bestMoveScore = Math.max(...simulatedScores);

return alpha + (beta - alpha > 1 ? beta : (alpha + beta) / 2) * (bestMoveScore - avgSimulatedScores);
}

function fuzzHarness(game: Game, maxDepth: number, numSimulations: number, temperatureDecay: number) {
const state = game.getInitialState();

for (let i = 0; i < numSimulations; ++i) {
const bestMoveIndex = monteCarloSimulation(game, state, maxDepth, -Infinity, Infinity, 1).toString().indexOf('-') === 0 ? -1 : Math.floor(Math.random() * game.getValidMoves(state).length);
state[game.boardSize * (game.boardSize - 1) / 2] = game.makeMove(state, bestMoveIndex)[game.boardSize * (game.boardSize - 1) / 2];
}
}
