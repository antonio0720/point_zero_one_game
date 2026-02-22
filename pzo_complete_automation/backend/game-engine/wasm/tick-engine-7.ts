import { Entity } from "./Entity";
import { System } from "./System";

class TickEngine {
private entities: Entity[];
private systems: System[];

constructor() {
this.entities = [];
this.systems = [];
}

addEntity(entity: Entity) {
this.entities.push(entity);
}

addSystem(system: System) {
this.systems.push(system);
}

run(deltaTime: number) {
const snapshots = new Map<Entity, any>(); // entity component snapshot map

for (const entity of this.entities) {
snapshots.set(entity, entity.serialize());
}

for (const system of this.systems) {
system.run(deltaTime, (entity, component) => {
const prevComponent = snapshots.get(entity)?.[component.key];
if (prevComponent !== undefined) {
entity.update(component, prevComponent);
}
});
}

for (const entity of this.entities) {
entity.deserialize(snapshots.get(entity));
}
}
}
