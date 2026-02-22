import * as wasm from 'wasm-game-engine';

interface GameObject {
update(deltaTime: number): void;
}

class State {
public objects: GameObject[];

constructor() {
this.objects = [];
}

addObject(obj: GameObject) {
this.objects.push(obj);
}

updateAllObjects(deltaTime: number) {
for (const obj of this.objects) {
obj.update(deltaTime);
}
}
}

class GameEngine {
private state: State;

constructor() {
const wasmModule = new WebAssembly.Module(wasm.bytes);
const instance = new WebAssembly.Instance(wasmModule);
this.state = new State();
}

addObject(obj: GameObject) {
this.state.addObject(obj);
}

start() {
const runEngine = (instance as any).exports.runEngine;
const mainLoop = setInterval(() => {
runEngine(this.state);
}, 16);

return () => clearInterval(mainLoop);
}
}

// Example GameObject
class MyGameObject implements GameObject {
public position: [number, number];

constructor() {
this.position = [0, 0];
}

update(deltaTime: number) {
const speed = 2;
this.position[0] += speed * deltaTime;
}
}

// Usage
const engine = new GameEngine();
engine.addObject(new MyGameObject());
const stopper = engine.start();
// ... some time passes ...
stopper();
