import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WASM_engine_16 from './WASM-engine-16';

describe('WASM-engine-16', () => {
it('renders the WASM-engine-16 component', () => {
render(<WASM_engine_16 />);
const linkElement = screen.getByText(/WASM-engine-16/i);
expect(linkElement).toBeInTheDocument();
});

it('should pass when WASM module loads successfully', async () => {
// Assuming you have a mock for the WebAssembly.instanti8() method
const onModuleLoaded = jest.fn();
window.WebAssembly = {
instantiate: (module, importObject) => Promise.resolve({ instance: { export: onModuleLoaded } })
};

render(<WASM_engine_16 />);
await new Promise(setImmediate); // Wait for the async WebAssembly load to complete
expect(onModuleLoaded).toHaveBeenCalledTimes(1);
});
});
