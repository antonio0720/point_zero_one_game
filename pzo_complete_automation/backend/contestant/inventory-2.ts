type Item = { id: string, name: string, quantity: number };
type Inventory = Map<string, Map<string, number>>;
type Contestant = { id: string, inventory: Inventory };

const contestants: Contestant[] = [];
let nextContestantId = 1;

function createContestant(): Contestant {
const id = String(nextContestantId++);
const inventory = new Map<string, number>();
return { id, inventory };
}

async function addItem(contestantId: string, item: Item): Promise<void> {
const contestant = findContestantById(contestantId);
if (!contestant) {
throw new Error(`Contestant with id "${contestantId}" not found`);
}
contestant.inventory.set(item.id, (contestant.inventory.get(item.id) || 0) + item.quantity);
}

async function removeItem(contestantId: string, itemId: string, quantity: number): Promise<void> {
const contestant = findContestantById(contestantId);
if (!contestant) {
throw new Error(`Contestant with id "${contestantId}" not found`);
}
const currentQuantity = contestant.inventory.get(itemId) || 0;
if (currentQuantity < quantity) {
throw new Error(`Insufficient quantity of item ${itemId} in the inventory`);
}
contestant.inventory.set(itemId, currentQuantity - quantity);
}

function findContestantById(contestantId: string): Contestant | undefined {
return contestants.find(({ id }) => id === contestantId);
}

// Example usage
const contestant1 = createContestant();
const item1 = { id: "item1", name: "Sword", quantity: 1 };
addItem(contestant1.id, item1).then(() => console.log(`Added ${item1.name} to ${contestant1.id}`));
