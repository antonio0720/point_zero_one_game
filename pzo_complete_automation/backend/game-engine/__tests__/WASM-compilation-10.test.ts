import { registerAssertions } from 'fs-assert';
import { init as initWasm } from '../src/wasm-compiler';
import { readFileSync } from 'fs';

const wasmPath = './build/wasm_compilation_10.wasm';

registerAssertions({
equalBuffer: function (actual, expected) {
const actualHex = Buffer.from(actual).toString('hex');
const expectedHex = Buffer.from(expected).toString('hex');

if (actualHex !== expectedHex) {
this.throwError(`Buffers do not match.\n  Expected: ${expectedHex}\n  Actual:   ${actualHex}`);
}
},
});

describe('WASM Compilation - WASM-compilation-10', () => {
beforeAll(async () => {
await initWasm();
});

test('Test case 1', () => {
const wasmModule = new WebAssembly.Module(new Uint8Array(readFileSync(wasmPath)));
const instance = new WebAssembly.Instance(wasmModule);
const result = instance.exports.run();

// Add your assertions here based on the expected output for this test case.
});

// Add more test cases as needed.
});
