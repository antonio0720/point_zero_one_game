Here is a TypeScript code for the "Synergy Overload 4" feature in an advanced gameplay context. This code assumes that you have already set up your project with the necessary dependencies and types.

```typescript
import { Synergy, GameObject } from '../interfaces';

const SYNERGY_OVERLOAD_4: Synergy = {
id: 'synergy-overload-4',
name: 'Synergy Overload 4',
description: 'Unlocks powerful bonuses when four or more synergies are active.',
bonusActivationConditions: (synergies: Set<string>) => synergies.size >= 4,
gameObjectsAppliedTo: (gameObjects: GameObject[]) =>
gameObjects.filter((go) => go.synergies.has('synergy-overload-4')),
bonuses: {
boostAttack: 0.25,
boostDefense: 0.25,
boostHealth: 0.25,
boostSpeed: 0.25,
bonusAbility: () => ({
name: 'Overload Burst',
cooldown: 10,
effect: (target: GameObject) => {
target.health -= Math.max(target.health * 0.3, 100);
},
}),
},
};

export default SYNERGY_OVERLOAD_4;
```

This code defines a `SynergyOverload4` object that conforms to the `Synergy` interface. It includes properties for the synergy's unique ID, name, description, activation conditions, game objects it affects, and bonuses it grants when active. In this case, the bonus ActivationConditions check if 4 or more synergies are active for a given game object. The bonuses include boosting attack, defense, health, speed, and providing an Overload Burst ability with a cooldown of 10 seconds. When used, the Overload Burst ability deals damage equal to a maximum of 30% of the target's current health or 100, whichever is greater.
