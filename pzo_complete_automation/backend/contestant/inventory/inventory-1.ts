enum ItemCategory {
FOOD,
DRINK,
EQUIPMENT
}

interface IItem {
id: number;
name: string;
category: ItemCategory;
quantity: number;
}

class Inventory {
private items: IItem[] = [];

addItem(item: IItem): void {
this.items.push(item);
}

removeItem(id: number): void {
this.items = this.items.filter((item) => item.id !== id);
}

getItemById(id: number): IItem | undefined {
return this.items.find((item) => item.id === id);
}

getTotalQuantity(): number {
return this.items.reduce((total, item) => total + item.quantity, 0);
}
}

class Contestant {
private inventory: Inventory = new Inventory();

addFood(name: string, quantity: number): void {
this.inventory.addItem({ id: Date.now(), name, category: ItemCategory.FOOD, quantity });
}

addDrink(name: string, quantity: number): void {
this.inventory.addItem({ id: Date.now(), name, category: ItemCategory.DRINK, quantity });
}

addEquipment(name: string, quantity: number): void {
this.inventory.addItem({ id: Date.now(), name, category: ItemCategory.EQUIPMENT, quantity });
}

getTotalItems(): number {
return this.inventory.items.length;
}
}
