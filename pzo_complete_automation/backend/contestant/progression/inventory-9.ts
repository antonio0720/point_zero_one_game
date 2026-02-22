import { ContestantCore } from "../contestant-core";

class Inventory9 extends ContestantCore {
private _items: string[];

constructor(name: string, items: string[]) {
super(name);
this._items = items;
}

get items(): string[] {
return this._items;
}

addItem(item: string): void {
if (!this.containsItem(item)) {
this._items.push(item);
}
}

removeItem(item: string): boolean {
const index = this._items.indexOf(item);
if (index !== -1) {
this._items.splice(index, 1);
return true;
}
return false;
}

containsItem(item: string): boolean {
return this._items.includes(item);
}
}

export { Inventory9 };
