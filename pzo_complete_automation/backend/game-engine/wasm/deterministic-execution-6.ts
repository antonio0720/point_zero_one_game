import * as wasm from './deterministic-execution-6_bg.wasm';
import { WasmMemory } from 'wasm-pkg';

const MEMORY_SIZE = 1024;
const STACK_SIZE = 128;
const MAX_OPCODES = 32;

class DeterministicExecutor {
private wasmInstance: any;
private memory: WasmMemory;
private stack: Uint8Array;

constructor() {
this.memory = new WasmMemory({ initial: MEMORY_SIZE });
this.stack = new Uint8Array(STACK_SIZE);
this.wasmInstance = wasm.instantiate(this.memory.buffer);
}

private readMemory(address: number) {
return new TextEncoder().encode(this.memory.getBuffer()).subarray(address, address + 1)[0];
}

private writeMemory(address: number, value: number) {
this.memory.setBuffer(new Uint8Array([value]));
const buffer = new Uint8Array(this.memory.buffer);
return buffer[address];
}

public run(code: Uint8Array): number {
if (code.length > MAX_OPCODES) throw new Error('Code exceeds the maximum number of opcodes.');

const func = this.wasmInstance.exports.run;
func({ code: code, stack: this.stack });

return this.stack[0];
}
}

export { DeterministicExecutor };
