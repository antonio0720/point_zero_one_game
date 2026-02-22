class Inventory {
private items: { [key: string]: number } = {};
private maxWeight: number;

constructor(maxWeight: number) {
this.maxWeight = maxWeight;
}

addItem(item: string, quantity: number, weight: number): void {
if (this.items[item]) {
this.items[item] += quantity;
} else {
this.items[item] = quantity;
}

const itemWeight = this.items[item] * weight;

if (this.getTotalWeight() + itemWeight > this.maxWeight) {
throw new Error(`Cannot add ${item}. Inventory exceeds max weight.`);
}
}

removeItem(item: string, quantity: number): void {
if (!this.items[item] || this.items[item] < quantity) {
throw new Error(`Not enough ${item} in inventory to remove.`);
}

this.items[item] -= quantity;
}

hasItem(item: string): boolean {
return this.items[item] !== undefined;
}

getTotalWeight(): number {
let totalWeight = 0;

for (const item in this.items) {
totalWeight += this.items[item] * this.getItemWeight(item);
}

return totalWeight;
}

private getItemWeight(item: string): number {
// You can either set the weights explicitly for each item, or you can calculate them based on the name/ID of the item.
const defaultWeight = 1; // Default weight if not specified
return this.getItemWeightByID(item) || defaultWeight;
}

private getItemWeightByID(itemId: string): number | undefined {
// Add your custom logic to retrieve the weight of an item based on its ID.
// For example, you could use a map or database lookup to find the weight.
if (itemId === 'example-heavy-item') {
return 5;
}
return undefined;
}
}
