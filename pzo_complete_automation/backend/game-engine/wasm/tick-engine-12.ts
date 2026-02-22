export class TickEngine {
private state: Map<number, GameObject>;
private timestamp: number;
private deltaTime: number;

constructor() {
this.state = new Map();
this.timestamp = performance.now();
this.deltaTime = 0;
}

public addGameObject(gameObject: GameObject) {
this.state.set(gameObject.id, gameObject);
}

public removeGameObject(id: number) {
this.state.delete(id);
}

public update(dt: number): void {
const currentTime = performance.now();
this.deltaTime = (currentTime - this.timestamp) * 0.001;
this.timestamp = currentTime;

for (const gameObject of this.state.values()) {
gameObject.update(this.deltaTime);
}
}
}

export abstract class GameObject {
protected id: number;

constructor(id: number) {
this.id = id;
}

public abstract update(dt: number): void;
}
