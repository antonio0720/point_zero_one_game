import * as wasm from './game-wasm/tick_engine';

class TickEngine {
private _state: Uint32Array;
private _buffer: Uint32Array;
private _memory: WebAssembly.Memory;
private _instance: any;

constructor() {
this._state = new Uint32Array(1);
this._buffer = new Uint32Array(4096);
this._memory = new WebAssembly.Memory({ initial: 4096 });

const wasmModule = await WebAssembly.compileStreamingFromURL('./game-wasm/tick_engine.wasm');
this._instance = await WebAssembly.instantiate(wasmModule, {
env: {
memory: this._memory,
state: this._state,
buffer: this._buffer,
_malloc: (size) => {
const start = this._memory.grow((this._memory.buffer.length + size));
return new Uint32Array(this._memory.buffer, start, size);
},
_free: (ptr, len) => {
// Implement memory deallocation logic here
},
},
});
}

run(entities: number[], deltaTime: number): void {
const args = new ArrayBuffer(16);
new DataView(args).setInt32(0, entities.length);
new DataView(args).setFloat64(4, deltaTime, true);

for (let i = 0; i < entities.length; ++i) {
new DataView(args).setUint32(8 + (i * 4), entities[i], true);
}

this._instance.exports.run(this._state, args);
}
}
