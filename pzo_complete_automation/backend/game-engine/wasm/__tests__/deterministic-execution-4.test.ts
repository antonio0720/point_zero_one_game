import { describe, it, expect } from 'vitest';
import { createWasmEngine } from '../wasm/game_engine';
import { runDeterministicScript } from '../deterministic-execution';

describe('Deterministic run engine - deterministic-executination-4', () => {
let wasmModule: any;
let engine: any;

beforeAll(async () => {
wasmModule = await createWasmEngine();
engine = new GameEngineWebAssembly(wasmModule);
});

it('should execute the deterministic script successfully', () => {
const code = `(module
(func $run (export "run")
(local $a i32)
(set_local $a 10)
(get_local $a)
(i32.const 5)
(i32.add)
(return)
)
)`;

const result = runDeterministicScript(engine, code);
expect(result).toEqual(15);
});
});
