```typescript
const assetManager = new AssetManager();
assetManager.addAsset({ id: 'a1', name: 'First Asset' });
assetManager.addAsset({ id: 'a2', name: 'Second Asset' });
```

Next, create a `SynergyManager` instance and add synergies:

```typescript
const synergyManager = new SynergyManager(assetManager);
synergyManager.addSynergy({
id: 's1',
assets: ['a1', 'a2'],
bonus: 5,
});
```

Finally, apply the synergies to a list of units (assets):

```typescript
const units = [assetManager.getAsset('a1')!, assetManager.getAsset('a2')!];
synergyManager.applySynergyBonuses(units);
console.log(units[0].bonus); // Output: 5 (because 'a1' is included in the synergy)
console.log(units[1].bonus); // Output: 0 (because 'a2' is also included but it doesn't have any synergies applied yet)
```
