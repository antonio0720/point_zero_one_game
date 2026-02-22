import * as wasm from 'wasm-game-engine';

// Initialize the WASM module
async function init() {
const memory = new WebAssembly.Memory({ initial: 256 });
const instance = await WebAssembly.instantiateStreaming(
fetch('deterministic_execution_12.wasm'),
{ memory, env: wasm.initWASMEnvironment() }
);

const { deterministicRun } = new (instance.instance.exports as any)();
return deterministicRun;
}

// Main function to execute the game logic in a deterministic manner using WASM
async function runGame(gameData: Uint8Array, seed: BigInt) {
const deterministicRun = await init();
deterministicRun(seed, gameData);
}
