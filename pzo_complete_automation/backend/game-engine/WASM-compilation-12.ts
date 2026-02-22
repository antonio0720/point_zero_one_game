import * as wasm from "./game-engine.wasm";

const memory = new WebAssembly.Memory({ initial: 1, maximum: 100 });
const instance = new WebAssembly.Instance(wasm, {
env: {
memory,
print_str: (msg: string) => console.log(`[WASM] ${msg}`),
game_init: () => 0,
game_tick: (state: number, action: number) => wasm._dyn_game_tick(memory.buffer, state, action),
game_is_over: (state: number) => wasm._dyn_game_is_over(memory.buffer, state),
game_get_reward: (state: number) => wasm._dyn_game_get_reward(memory.buffer, state),
},
});

const game_tick = instance.exports.game_tick;
const game_is_over = instance.exports.game_is_over;
const game_get_reward = instance.exports.game_get_reward;

// Example usage:
function playGame(state: number, actions: number[]) {
for (let i = 0; i < actions.length; ++i) {
const nextState = game_tick(state, actions[i]);
if (game_is_over(nextState)) {
return game_get_reward(nextState);
}
state = nextState;
}
}
