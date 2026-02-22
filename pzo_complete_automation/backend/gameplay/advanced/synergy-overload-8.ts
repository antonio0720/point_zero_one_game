interface Character {
name: string;
synergies: number[];
}

interface Ability {
name: string;
cost: number;
effects: (character: Character) => void;
}

const characters: Character[] = [
// list of game characters
];

const abilities: Ability[] = [
// list of game abilities
];

function hasSynergy(a: Character, b: Character): boolean {
return a.synergies.includes(b.id) || b.synergies.includes(a.id);
}

function synergyOverload8(characters: Character[]): void {
const synergizedPairs = characters
.slice()
.sort((a, b) => a.synergies[7] - b.synergies[7])
.reduce<{ [key: number]: Character[] }>((acc, character, index, array) => {
if (index > 0 && hasSynergy(character, array[index - 1])) {
const pair = [array[index - 1], character];
acc[pair.length] = pair;
}
return acc;
}, {});

for (const [_, pair] of Object.entries(synergizedPairs)) {
const [characterA, characterB] = pair;

abilities.forEach((ability) => {
if (characterA.mana >= ability.cost && characterB.mana >= ability.cost) {
ability.effects(characterA);
ability.effects(characterB);
characterA.mana -= ability.cost;
characterB.mana -= ability.cost;
}
});
}
}
