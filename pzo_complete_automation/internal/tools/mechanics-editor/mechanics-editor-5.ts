class Box {
constructor(x, y, width, height) {
this.body = Matter.Body.create({ x, y, width, height });
this.shape = Matter. Bodies.rectangle(this.body.position.x, this.body.position.y, width, height);
Matter.Composites.add(Matter.World.engine.world, [this.body], { isStatic: true });
Matter.World.add(engine.world, this.shape);
}
}

class Engine {
constructor() {
this.engine = Matter.Engine.create();
this.render = Matter.World.createRenderer({
element: document.body,
style: { width: '100%', height: '100%' },
wireframes: false,
backgroundColor: '#2C3E50'
});
Matter.World.add(this.engine.world, [
new Box(400, 300, 80, 80),
]);
this.update = () => {
Matter.Engine.update(this.engine);
this.render.draw();
requestAnimationFrame(this.update);
};
this.start = () => {
this.update();
}
}
}

let engine = new Engine();
engine.start();
