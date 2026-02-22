import { Contestant } from './contestant';

export class InventoryManager {
private inventory: Map<string, Contestant> = new Map();

addItem(contestant: Contestant): void {
this.inventory.set(contestant.id, contestant);
}

removeItem(id: string): void {
this.inventory.delete(id);
}

getItem(id: string): Contestant | undefined {
return this.inventory.get(id);
}
}
