import { Actor, Scene, Timer, Vector } from "excalibur";
import { Resources } from "./Resources";
import { Paddle, Ball } from "./objects/GameObjects";

export function init() {
const engine = new excalibur.Engine({
width: 800,
height: 600,
vSync: true,
backgroundColor: new excalibur.Colors.Black(),
disableWebGL: false,
});

const scene = new Scene({ engine });

Resources.loadAll().then(() => {
const paddle = new Paddle(engine, new Vector(400, 570));
scene.add(paddle);

const ball = new Ball(engine, new Vector(400, 550));
scene.add(ball);

engine.eventsOn(Scene).on("postUpdate", (event) => {
if (!ball.collidesWith(paddle)) {
const dx = ball.velocity.x > 0 ? -2 : 2;
ball.velocity = new Vector(dx, ball.velocity.y);
}
});

engine.start();
});
}
