import { Game } from "../game";
import { Player } from "../player";
import { GameObject } from "../gameobject";
import { TileMap } from "../tilemap";
import { Vector2 } from "../math/vector2";
import { RandomGenerator } from "../utils/random-generator";

const game = new Game();
const player1 = new Player(new Vector2(0, 0), game);
const player2 = new Player(new Vector2(50, 50), game);
const tileMap = new TileMap(game.width, game.height);
const randomGenerator = new RandomGenerator();

const numGameObjects = 1000;
const objects: GameObject[] = [];

for (let i = 0; i < numGameObjects; i++) {
const position = new Vector2(
randomGenerator.getRandomInt(game.width),
randomGenerator.getRandomInt(game.height)
);
objects.push(new GameObject(position, game));
}

tileMap.render();

function update() {
player1.update();
player2.update();

for (const object of objects) {
object.update();
}

tileMap.update();
}

function draw() {
game.context.clearRect(0, 0, game.width, game.height);
tileMap.draw();
player1.draw();
player2.draw();

for (const object of objects) {
object.draw();
}
}

game.onUpdate = update;
game.onDraw = draw;
game.run();
