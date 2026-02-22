import * as wasm from "./deterministic-execution-5_bg.wasm";
import { Memory } from "wasm-pack-std";

const memory = new Memory({ initial: 256 });
const instance = new WebAssembly.Instance(wasm, {
env: {
memory: memory,
},
});

interface DeterministicEngine {
init: (code: Uint8Array) => number;
step: () => void;
getResult: () => Uint32Array;
}

const engine: DeterministicEngine = {
init(code) {
const buffer = new ArrayBuffer(16 + code.length);
new Uint32Array(buffer).set([1, ...new Uint32Array(code)]); // padding and code array
instance.exports.init(memory.buffer, buffer);
return memory.grow();
},

step() {
instance.exports.step(memory.buffer);
},

getResult() {
const result = new Uint32Array(memory.buffer, 0, 4);
for (let i = 0; i < 4; i++) {
if (result[i] === 0) {
throw new Error("Game over");
}
}
return result;
},
};

export default engine;
