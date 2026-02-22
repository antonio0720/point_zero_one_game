enum GameState {
Empty,
Player1,
Player2,
}

interface Point {
x: number;
y: number;
}

interface Position {
point: Point;
state: GameState;
}

const boardSize = 3;
const movesList = [
[-1, -2],
[-1, 0],
[-1, 2],
[0, -1],
[0, 1],
[0, 2],
[1, -2],
[1, 0],
[1, 2],
] as const;

const board: Position[] = Array(boardSize * boardSize)
.fill({ point: { x: 0, y: 0 }, state: GameState.Empty })
.map((_, index) => ({ ..._, index }));

function isValidMove(move: Point): boolean {
const [dx, dy] = move;
if (dx < -boardSize || dx > boardSize || dy < -boardSize || dy > boardSize) {
return false;
}

const [x, y] = [Math.floor(move.x), Math.floor(move.y)];
return board[x + y * boardSize].state === GameState.Empty;
}

function makeMove(move: Point): void {
const [x, y] = [Math.floor(move.x), Math.floor(move.y)];
if (isValidMove(move)) {
board[x + y * boardSize].state = board[playingPlayer].point === move ? GameState.Player1 : GameState.Player2;
const possibleMoves = movesList.filter(([dx, dy]) => isValidMove({ x: dx + move.x, y: dy + move.y }));
if (possibleMoves.length === 3) {
board[playingPlayer].point = move;
playingPlayer = playingPlayer === 0 ? 1 : 0;
} else {
board[x + y * boardSize].state = GameState.Empty;
}
}
}

let playingPlayer = 0;

function play(inputFuzz: number[]): void {
const moves = inputFuzz.map((move) => ({ x: move % boardSize, y: Math.floor(move / boardSize) }));

for (const move of moves) {
makeMove(move);
}
}

function isGameOver(): boolean {
const player1Count = movesList.reduce((count, [dx, dy]) => count + (board[Math.floor(dx + 1) + (dy * boardSize)].state === GameState.Player1), 0);
const player2Count = movesList.reduce((count, [dx, dy]) => count + (board[Math.floor(dx + 1) + (dy * boardSize)].state === GameState.Player2), 0);

return player1Count + player2Count >= boardSize ** 2 - 9;
}

function runSimulation(inputFuzz: number[]): void {
play(inputFuzz);

while (!isGameOver()) {
const possibleMoves = movesList.filter(([dx, dy]) => isValidMove({ x: dx, y: dy }));
if (possibleMoves.length === 0) {
break;
}

makeMove(possibleMoves[Math.floor(Math.random() * possibleMoves.length)]);
}
}
