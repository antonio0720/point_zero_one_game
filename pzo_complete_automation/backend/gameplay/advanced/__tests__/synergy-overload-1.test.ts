import { GameState } from "../../../game-state";
import { Unit } from "../../../units/unit";
import { SynergyOverloadEffect } from "../synergy-overload-effect";
import { BuffType, StatType } from "../../../enums/buff-types";
import { Buff } from "../../../buffs/buff";
import { TestHelper } from "../../test-helper";

describe('Synergy Overload', () => {
let state: GameState;
let testHelper: TestHelper;

beforeEach(() => {
state = new GameState();
testHelper = new TestHelper(state);
});

it('should apply Synergy Overload effect correctly', () => {
const unit1 = new Unit('Unit1');
const unit2 = new Unit('Unit2');
const synergyOverloadEffect = new SynergyOverloadEffect();

// Initialize states
state.units.push(unit1, unit2);

// Apply initial effects
testHelper.applyBuffToUnit(unit1, new Buff('Test Buff', { [StatType.Attack]: 10 }));
testHelper.applyBuffToUnit(unit2, new Buff('Test Buff', { [StatType.Defense]: 10 }));

// Apply Synergy Overload effect to both units
synergyOverloadEffect.activateEffects(state);

expect(unit1.buffs.getBuffByType(BuffType.SynergyOverload)).toBeTruthy();
expect(unit2.buffs.getBuffByType(BuffType.SynergyOverload)).toBeTruthy();

// Check if Attack and Defense have been increased for both units
expect(unit1.stats[StatType.Attack]).toBeGreaterThanOrEqual(20); // 10 initial + 10 from Synergy Overload
expect(unit2.stats[StatType.Defense]).toBeGreaterThanOrEqual(20); // 10 initial + 10 from Synergy Overload
});

it('should remove Synergy Overload effect correctly when another unit dies', () => {
const unit1 = new Unit('Unit1');
const unit2 = new Unit('Unit2');
const synergyOverloadEffect = new SynergyOverloadEffect();

// Initialize states
state.units.push(unit1, unit2);

// Apply initial effects
testHelper.applyBuffToUnit(unit1, new Buff('Test Buff', { [StatType.Attack]: 10 }));
testHelper.applyBuffToUnit(unit2, new Buff('Test Buff', { [StatType.Defense]: 10 }));

// Apply Synergy Overload effect to both units
synergyOverloadEffect.activateEffects(state);

expect(unit1.buffs.getBuffByType(BuffType.SynergyOverload)).toBeTruthy();
expect(unit2.buffs.getBuffByType(BuffType.SynergyOverload)).toBeTruthy();

// Simulate unit1 death
testHelper.applyDamageToUnit(unit1, 1);

expect(unit1.isAlive).toBeFalsy();

// Check if Synergy Overload effect is removed from the surviving unit
expect(unit2.buffs.getBuffByType(BuffType.SynergyOverload)).toBeFalsy();
});
});
