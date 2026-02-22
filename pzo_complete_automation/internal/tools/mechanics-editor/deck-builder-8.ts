export interface Card {
id: string;
name: string;
description: string;
cost: number;
effects: Effect[];
}

export interface Effect {
type: string; // e.g. 'attack', 'heal'
value: number;
}

const card1: Card = {
id: 'card1',
name: 'Card One',
description: 'A powerful offensive card.',
cost: 5,
effects: [
{ type: 'attack', value: 3 },
{ type: 'heal', value: 2 }
]
};
