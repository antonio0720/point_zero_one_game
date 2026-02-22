import { WasmLoader } from 'wasm-loader';
import * as wasmCode from './game_engine.wasm';

interface GameEngine {
init: (seed: number) => void;
update: () => void;
draw: () => void;
}

async function createGameEngine(): Promise<GameEngine> {
const memory = new WebAssembly.Memory({ initial: 256 });
const wasmModule = await WasmLoader(wasmCode);

const gameEngine = {
init: (seed: number) => {
wasmModule.instance.exports.init(seed, { index: memory.buffer });
},
update: () => wasmModule.instance.exports.update(),
draw: () => wasmModule.instance.exports.draw(),
} as GameEngine;

return gameEngine;
}

(async () => {
const engine = await createGameEngine();
engine.init(Math.random()); // Initialize with a seed

setInterval(() => {
engine.update();
engine.draw();
}, 1000 / 60); // Update every frame (assuming 60 FPS)
})();
