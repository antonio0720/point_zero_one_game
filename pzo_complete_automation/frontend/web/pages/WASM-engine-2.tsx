import * as React from 'react';
import * as wasm from './wasm_module.wasm';

declare global {
interface Window {
WebAssembly: typeof WebAssembly;
wasmInstance: any;
}
}

class WASMComponent extends React.Component<{}, {}> {
componentDidMount() {
if (!('WebAssembly' in window && 'InstancedArray' in window)) {
console.error(
"Your browser does not support WebAssembly."
);
return;
}

const init = async () => {
const response = await fetch('./wasm_module.wasm');
const arrayBuffer = await response.arrayBuffer();
const wasmModule = await WebAssembly.instantiate(arrayBuffer);

window.wasmInstance = wasmModule.instance;
};

init().catch((e) => console.error(e));
}

callWASMFunction() {
// Assuming that you have a function named 'exportedFunction' in your WASM module
const { exports } = window.wasmInstance;
const result = exports.exportedFunction();

console.log(result);
}

render() {
return <button onClick={() => this.callWASMFunction()}>Run WASM</button>;
}
}

export default WASMComponent;
