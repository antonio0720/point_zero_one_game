Here is a TypeScript code for a Contestant class with an Inventory property that can hold up to 10 items. Each item has a name and value.

```typescript
class Item {
constructor(public name: string, public value: number) {}
}

class Contestant {
private inventory: Item[] = [];

addItem(item: Item): void {
if (this.inventory.length < 10) {
this.inventory.push(item);
}
}

getTotalValue(): number {
return this.inventory.reduce((total, item) => total + item.value, 0);
}
}
```

This code defines an `Item` class with a name and value, and a `Contestant` class that manages the inventory of items. The `addItem` method checks if there's still room in the inventory before adding an item, and the `getTotalValue` method calculates the total value of all items in the inventory.
