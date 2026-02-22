import * as wasm from './game-engine.wasm';

interface GameEngine {
new(input: Uint8Array): void;
tick(): void;
}

function initGameEngine(): GameEngine {
const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
const wasmInstance = new WebAssembly.Instance(wasm, {
env: {
memory,
},
});
const gameEngine = wasmInstance.exports as GameEngine;
return gameEngine;
}

const engine = initGameEngine();
let input: Uint8Array;

function setInput(data: Uint8Array) {
input = data;
}

function run() {
const view = new DataView(input.buffer);
view.setUint32(0, input.byteLength - 16); // Set the length to exclude function signature
engine.tick();
}

// Usage example:
const testInput = new Uint8Array([...]); // Replace with your input data array
setInput(testInput);
run();
