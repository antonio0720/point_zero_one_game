import { Mechanic } from '../interfaces';

const mechanicsIngestion9 = (deck: Mechanic[]): Mechanic[] => {
const filteredDeck = deck.filter(mechanic => {
return (
mechanic.speed === 'Fast' ||
(mechanic.speed === 'Medium' && mechanic.cost < 5)
);
});

const groupedByType = filteredDeck.reduce((acc, currentMechanic) => {
const { type, ...rest } = currentMechanic;
if (!acc[type]) {
acc[type] = [];
}
acc[type].push(rest);
return acc;
}, {} as { [key: string]: Mechanic[] });

const sortedByCount = Object.entries(groupedByType).sort((a, b) => {
return b[1].length - a[1].length;
});

const topThreeTypes = sortedByCount
.slice(0, 3)
.map(([type, mechanics]) => mechanics[0]); // returns the first mechanic of each type

return topThreeTypes;
};

export default mechanicsIngestion9;
