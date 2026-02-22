import * as wasm from "./tick-engine-4_bg.wasm";

interface GameObject {
id: number;
x: number;
y: number;
}

let gameObjects: Array<GameObject> = [];

function init() {
const wasmModule = wasm.instantiate();
wasmModule.exports.init(gameObjects);
}

function update() {
for (const obj of gameObjects) {
// Add your custom update logic here
}
}

function render() {
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

ctx.clearRect(0, 0, canvas.width, canvas.height);

for (const obj of gameObjects) {
ctx.fillRect(obj.x, obj.y, 30, 30);
}
}

function tick() {
update();
render();
requestAnimationFrame(tick);
}

init();
tick();
