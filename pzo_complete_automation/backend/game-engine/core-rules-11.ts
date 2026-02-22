class GameEngine {
private state: string[];

constructor() {
this.state = ['P', '.', '.'];
}

public play(player: number, x: number, y: number): void {
if (this.isValidMove(x, y)) {
const newState = this.state.slice();
newState[y] = player === 1 ? 'O' : 'X';
newState[y * 3 + x + 1] = player === 1 ? '.' : 'P';
this.state = newState;
}
}

public isGameOver(): boolean {
const winningCombinations = [
// Rows
[0, 1, 2],
[3, 4, 5],
[6, 7, 8],
// Columns
[0, 3, 6],
[1, 4, 7],
[2, 5, 8],
// Diagonals
[0, 4, 8],
[2, 4, 6]
];

for (const combination of winningCombinations) {
const [x1, x2, x3] = combination;
if (this.state[x1] && this.state[x1] === this.state[x2] && this.state[x2] === this.state[x3]) {
return true;
}
}

// Check for a draw
const emptySpaces = this.state.filter(square => square === '.').length;
return emptySpaces === 0;
}

private isValidMove(x: number, y: number): boolean {
return (
x >= 0 && x < 3 &&
y >= 0 && y < 3 &&
this.state[y] === '.'
);
}
}
