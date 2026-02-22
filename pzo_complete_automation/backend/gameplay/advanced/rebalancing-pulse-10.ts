```typescript
export class Gameplay {
rebalancePulse10(entities: Entity[]) {
entities.forEach((entity) => {
if (entity.power > entity.maxPower * 0.8) {
entity.power *= 0.9;
} else if (entity.power < entity.minPower * 0.2) {
entity.power *= 1.5;
}
});
}
}

interface Entity {
power: number;
maxPower: number;
minPower: number;
}
```

This code defines a `Gameplay` class with a method called `rebalancePulse10`. This method takes an array of `Entity` objects, each with properties for `power`, `maxPower`, and `minPower`. The function iterates over the entities and adjusts their power based on certain conditions. If the entity's power is greater than 80% of its maximum power, it reduces the power by 10%. If the power is less than 20% of its minimum power, it increases the power by 50%.
