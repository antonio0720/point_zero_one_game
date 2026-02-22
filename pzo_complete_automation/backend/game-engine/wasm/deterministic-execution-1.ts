import * as wasm from 'wasml/dist/wasm-loader';
import { crypto } from 'crypto';

const hashAlgorithm = 'sha3-256';

class DeterministicExecution {
private _instance: any;
private _moduleBuffer: Uint8Array;

constructor(moduleBuffer: Uint8Array) {
this._moduleBuffer = moduleBuffer;
}

async init() {
const wasmModule = await wasm.instantiate(this._moduleBuffer);
this._instance = wasmModule.instance.exports;
this.hash();
}

runFunction(functionName: string, args: any[]) {
return this._instance[functionName].apply(null, args);
}

hash() {
const buffer = new Uint8Array(this._moduleBuffer.length + 1);
buffer.set(this._moduleBuffer);
buffer.set([0], buffer.length - 1);

const digest = crypto.createHash(hashAlgorithm);
digest.update(buffer);
this._hash = digest.digest('hex');
}

get hash() {
return this._hash;
}
}

export default DeterministicExecution;
