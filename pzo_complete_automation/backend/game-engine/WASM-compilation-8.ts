import * as wasm from './wasm-compilation-8.wasm';

// Exported functions from WASM module
const instance = new WebAssembly.Instance(wasm, {
init: wasm.init,
run_game: wasm.run_game,
});

let memory = new Uint8Array(instance.exports.memory.buffer);
let dataView = new DataView(instance.exports.memory.buffer);

function getInt32(offset: number): number {
let result = dataView.getUint32(offset, true);
return result >>> 0;
}

function setInt32(offset: number, value: number) {
dataView.setUint32(offset, value, true);
}

function runGame() {
instance.exports.run_game();
}

// Initialize the game state
const playerPosition = 10;
setInt32(playerPosition * 4, playerPosition);
