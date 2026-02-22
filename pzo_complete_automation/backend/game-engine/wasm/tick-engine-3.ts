import * as wasm from './wasm/tick-engine-3.wasm';
import { init, update } from 'wasm-js-bindings';

init(wasm);

class GameWorld {
private world: Array<number>;

constructor(width: number, height: number) {
this.world = new Array(width * height).fill(0);
}

public getCell(x: number, y: number): number {
return this.world[y * this.world.length + x];
}

public setCell(x: number, y: number, value: number) {
this.world[y * this.world.length + x] = value;
}

public tick() {
update(this.world);
}
}

const gameWorld = new GameWorld(10, 10);

function mainLoop() {
gameWorld.tick();
requestAnimationFrame(mainLoop);
}

mainLoop();
