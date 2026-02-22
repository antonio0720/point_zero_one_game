import * as wasm from "wasm-bindgen";
import { WASM_FILENAME } from "./constants";

// Wasm module instance
let wasmInstance: any;

// Initialize the Wasm module
async function initWasm() {
const wasmBuffer = await fetch(WASM_FILENAME).then((res) => res.arrayBuffer());
wasmInstance = await WebAssembly.instantiate(wasmBuffer);
}

// Export the functions from the Wasm module
const { exports } = wasmInstance.instance.exports;

// Cache for storing state of all functions to avoid recomputation
let functionCache: Map<number, number[]> = new Map();

// Fetch and cache the result of a function call
function getFunctionResult(funcId: number, args: number[]) {
if (!functionCache.has(funcId)) {
functionCache.set(funcId, wasmCall(funcId, args));
}
return functionCache.get(funcId);
}

// Call a Wasm function using the cached state when possible
function wasmCall(funcId: number, args: number[]) {
const imports = {
get_state: (id: number) => functionCache.get(id),
set_state: (id: number, state: number[]) => {
functionCache.set(id, state);
},
};
return exports[funcId](...args.map((arg) => arg as any));
}

// Define the initialization function for the WebAssembly module
wasm.start();

initWasm().then(() => {
// You can now call Wasm functions using getFunctionResult() and wasmCall()
});
