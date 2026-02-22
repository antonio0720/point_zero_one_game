type Synergy = {
abilityId1: number;
abilityId2: number;
bonus: number;
};

interface Entity {
abilities: Ability[];
synergies: Synergy[];

applySynergies(): void;
}

class Ability {
constructor(public id: number, public basePower: number) {}
}

class SynergySystem {
entities: Entity[];

addEntity(entity: Entity) {
this.entities.push(entity);
}

update() {
this.entities.forEach((entity) => entity.applySynergies());
}
}

class EntityImplementation implements Entity {
abilities: Ability[];
synergies: Synergy[];

constructor(abilities: Ability[], synergies: Synergy[]) {
this.abilities = abilities;
this.synergies = synergies;
}

applySynergies() {
const bonuses = this.synergies.reduce((acc, synergy) => {
const ability1 = this.abilities.find((ability) => ability.id === synergy.abilityId1);
const ability2 = this.abilities.find((ability) => ability.id === synergy.abilityId2);

if (ability1 && ability2) {
acc[ability1.id] += synergy.bonus;
acc[ability2.id] += synergy.bonus;
}

return acc;
}, {} as Record<number, number>);

this.abilities.forEach((ability) => {
ability.basePower += bonuses[ability.id];
});
}
}
