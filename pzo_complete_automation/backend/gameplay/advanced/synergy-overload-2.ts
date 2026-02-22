const synergyOverload2: Synergy = {
id: 'overload-2',
name: 'Synergy Overload 2',
description: 'Boosts all stats significantly.',
effects: (gameObject) => {
gameObject.attack += 20;
gameObject.defense += 20;
gameObject.health += 50;
},
};

const synergyManager = new SynergyManager();
synergyManager.addSynergy(synergyOverload2);

// Apply the synergy to a game object when it's created or updated:
const player = new GameObject('Player');
player.onCreate || player.onUpdate = () => {
synergyManager.applySynergiesToGameObject(player);
};
```

This code creates a `SynergyManager` class that allows you to add and remove synergies from game objects. The `SynergyOverload2` example synergy boosts the attack, defense, and health of a game object when applied using the `applySynergiesToGameObject` method on the `SynergyManager`. You can create additional synergies or modify existing ones as needed.
