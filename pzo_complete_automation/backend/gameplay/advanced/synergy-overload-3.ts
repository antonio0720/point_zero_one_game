interface Ability {
name: string;
basePower: number;
synergyRequirements: Set<string>;
}

class Game {
private abilities: Map<string, Ability> = new Map();
private activeAbilities: Set<string> = new Set();

addAbility(ability: Ability) {
this.abilities.set(ability.name, ability);
}

activateAbility(abilityName: string): void {
const ability = this.abilities.get(abilityName);
if (ability && !this.activeAbilities.has(abilityName)) {
this.activeAbilities.add(abilityName);
this.applySynergyBonus(ability);
}
}

deactivateAbility(abilityName: string): void {
const ability = this.abilities.get(abilityName);
if (ability && this.activeAbilities.has(abilityName)) {
this.activeAbilities.delete(abilityName);
this.removeSynergyBonus(ability);
}
}

private applySynergyBonus(ability: Ability): void {
if (ability.synergyRequirements.size > 2) {
const activeAbilities = Array.from(this.activeAbilities);
const matchingAbilities = activeAbilities.filter((name) =>
ability.synergyRequirements.has(name)
);

if (matchingAbilities.length >= ability.synergyRequirements.size - 1) {
const bonusMultiplier = Math.pow(2, matchingAbilities.length - 2);
ability.basePower *= bonusMultiplier;
}
}
}

private removeSynergyBonus(ability: Ability): void {
if (ability.synergyRequirements.size > 2) {
ability.basePower /= Math.pow(2, this.activeAbilities.size - ability.synergyRequirements.size + 1);
}
}
}
