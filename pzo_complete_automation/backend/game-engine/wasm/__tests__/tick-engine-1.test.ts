import { TickEngine } from '../src/tick-engine';
import assert from 'assert';
import * as wasm from './tick_engine_bg';

describe('Deterministic run engine - tick-engine-1', () => {
let engine: TickEngine;

beforeEach(() => {
wasm.init();
engine = new TickEngine(wasm.tick);
});

afterEach(() => wasm.cleanup());

it('should tick a simple world with no initial entities', () => {
const world = engine.createWorld();

engine.tick(world, 10);

// Add your assertions here to check the state of the world after ticking
});

it('should tick a world with initially placed entities', () => {
const world = engine.createWorld();

// Add entities and their initial properties here

engine.tick(world, 10);

// Add your assertions here to check the state of the entities after ticking
});
});
