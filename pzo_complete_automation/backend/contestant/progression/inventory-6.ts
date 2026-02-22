class Contestant {
private _inventory: Map<number, Item> = new Map();

addItem(item: Item, slot: number): void {
if (slot < 1 || slot > 6) throw new Error('Invalid inventory slot');
if (this._inventory.has(slot)) throw new Error('Inventory slot already occupied');
this._inventory.set(slot, item);
}

removeItem(slot: number): void {
const item = this._inventory.get(slot);
if (!item) throw new Error('Inventory slot empty');
this._inventory.delete(slot);
}

hasItem(slot: number): boolean {
return this._inventory.has(slot);
}

getItem(slot: number): Item | undefined {
return this._inventory.get(slot);
}
}

interface Item {
name: string;
description: string;
}
