import * as react from 'react';
import * as wasm from './WASM-engine-14.wasm';

const instance = new (await WebAssembly.instantiate(await fetch('./WASM-engine-14.wasm').then(res => res.arrayBuffer())))
.instance;

interface Props { }

interface State {
result: number;
}

class WASMEngine14 extends react.Component<Props, State> {
state = {
result: 0,
};

componentDidMount() {
const func = instance.exports.main;
func({ arg1: 5, arg2: 7 }); // Replace the arguments as per your function requirements
this.setState({ result: func.return_val });
}

render() {
return <div>{this.state.result}</div>;
}
}

export default WASMEngine14;
