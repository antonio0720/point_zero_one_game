class Contestant {
private inventory: Map<string, number>;

constructor() {
this.inventory = new Map();
}

addItem(item: string, quantity: number): void {
if (!this.inventory.has(item)) {
this.inventory.set(item, quantity);
} else {
const currentQuantity = this.inventory.get(item)!;
this.inventory.set(item, currentQuantity + quantity);
}
}

removeItem(item: string, quantity: number): void {
if (!this.inventory.has(item)) {
throw new Error(`Item ${item} not found in inventory.`);
}

const currentQuantity = this.inventory.get(item)!;
if (currentQuantity < quantity) {
throw new Error(`Insufficient quantity of item ${item}.`);
}

this.inventory.set(item, currentQuantity - quantity);
}

getItemQuantity(item: string): number | undefined {
return this.inventory.get(item);
}
}
