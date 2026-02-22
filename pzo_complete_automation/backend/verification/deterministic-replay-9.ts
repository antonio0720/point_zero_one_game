export type GameState = {
player1: number[];
player2: number[];
};

function deterministicReplay(states: GameState[], actions: number[]): GameState {
const newStates: GameState[] = [];

for (let i = 0; i < states.length; i++) {
if (i + 1 < states.length && actions[i] === actions[i + 1]) {
// Merge consecutive identical actions
const mergedState = { ...states[i], ...states[i + 1] };
newStates.push(mergedState);
} else {
newStates.push(states[i]);
}
}

if (newStates.length < states.length) {
// If the final state has been reached or there are no more actions to apply
return newStates[newStates.length - 1];
}

throw new Error('Invalid action sequence');
}
