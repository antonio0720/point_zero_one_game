import * as wasm from './game-engine.wasm';

// Load WASM module
async function loadWasm(): Promise<WebAssembly.Module> {
const response = await fetch('./game-engine.wasm');
const arrayBuffer = await response.arrayBuffer();
return await WebAssembly.compile(arrayBuffer);
}

// Instantiate WASM module
async function instantiateWasm(module: WebAssembly.Module): Promise<WebAssembly.Instance> {
return new WebAssembly.Instance(module, imports);
}

const imports = {
// Define the C/C++ functions exported by game-engine.wasm and their TypeScript equivalents
_ZN5GameEngine3InitEPv: (initFunc: any) => initFunc(),
_ZN5GameEngine10RunStepEjj: (runStepFunc: any, deltaTime: number, frames: number) => runStepFunc(deltaTime, frames),
};

// Main function to start the game engine
async function main() {
const module = await loadWasm();
const instance = await instantiateWasm(module);
const initFunc = instance.exports._ZN5GameEngine3InitEPv;
const runStepFunc = instance.exports._ZN5GameEngine10RunStepEjj;

// Initialize the game engine
initFunc();

// Run the game engine loop
let lastTime = performance.now();
function animate() {
requestAnimationFrame(animate);
const timeDelta = Math.min(1, (performance.now() - lastTime) * 0.001);
runStepFunc(timeDelta, 1 / timeDelta);
lastTime = performance.now();
}
animate();
}

main();
