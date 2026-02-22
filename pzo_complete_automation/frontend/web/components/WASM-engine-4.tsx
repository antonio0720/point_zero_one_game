import * as React from 'react';
import * as wasm from './wasm-engine-4.wasm';

interface Props {}

interface State {
result: number;
}

class WASMEngine4 extends React.Component<Props, State> {
private instance: any;
private _arrayBuffer: ArrayBuffer;

constructor(props: Props) {
super(props);
this.state = { result: 0 };
}

componentDidMount() {
fetch('wasm-engine-4.wasm')
.then((response) => response.arrayBuffer())
.then((buffer) => {
this._arrayBuffer = buffer;
WebAssembly.instantiate(this._arrayBuffer, wasm)
.then((result: any) => {
this.instance = result.instance;
})
.catch((error) => console.log(error));
});
}

runAlgorithm = () => {
const { instance } = this;
if (instance) {
const { _arrayBuffer } = this;
WebAssembly.compile(_arrayBuffer).then((compiledModule) => {
const importObject = {
_dyn_alloc: Math.malloc,
_dyn_realloc: (ptr: number, len: number, oldLen: number) => {
if (oldLen > len) throw new Error('Shrinking memory');
return ptr;
},
_dyn_free: (ptr: number) => {
wasmMemory.buffer.subarray(ptr, ptr + 8).fill(0);
},
};

WebAssembly.instantiate(compiledModule, importObject)
.then(({ instance }) => {
instance.exports.runAlgorithm(); // Call the function in your WASM module
const result = instance.exports._returnValue; // Access the returned value from your WASM module
this.setState({ result });
})
.catch((error) => console.log(error));
});
}
}

render() {
return <div>Result: {this.state.result}</div>;
}
}

export default WASMEngine4;
