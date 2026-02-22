import { SynergyOverload6 } from "../synergy-overload-6";
import { Hero, HeroAbility, AbilityType } from "../../../hero";
import { TestHelper } from "../../test-helper";

describe('Advanced gameplay - synergy-overload-6', () => {
const testHelper = new TestHelper();

beforeEach(() => testHelper.setup());

afterEach(() => testHelper.teardown());

it('should correctly apply Synergy Overload 6', () => {
// Initialize heroes and abilities
const hero1 = new Hero("Hero1");
const hero2 = new Hero("Hero2");
const abilityA = new HeroAbility(hero1, "Ability A", AbilityType.Attack);
const abilityB = new HeroAbility(hero2, "Ability B", AbilityType.Support);

// Set up Synergy Overload 6 between Ability A and Ability B
SynergyOverload6.registerSynergy(abilityA, abilityB, bonusDamage);

// Apply the synergy in a test scenario
const hero1InitialHealth = hero1.health;
const hero2InitialHealth = hero2.health;

hero1.useAbility(abilityA);
hero2.useAbility(abilityB);

expect(hero1.health).toBeLessThan(hero1InitialHealth); // Hero1 should take damage due to Synergy Overload 6
expect(hero2.health).toBeGreaterThan(hero2InitialHealth); // Hero2 should gain health due to Synergy Overload 6
});
});
