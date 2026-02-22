import { Game, Player, Unit } from '../../game';
import { AdvancedSynergyOverload11 } from './advanced-synergy-overload-11';
import { expect } from 'chai';
import 'mocha';

describe('Advanced gameplay - Synergy Overload 11', () => {
let game: Game;
let player1: Player;
let player2: Player;
let unit1: Unit;
let unit2: Unit;

beforeEach(() => {
game = new Game();
player1 = game.addPlayer('Player 1');
player2 = game.addPlayer('Player 2');

unit1 = player1.createUnit('BasicUnit', 0, 0);
unit2 = player2.createUnit('BasicUnit', 0, 0);
});

it('Synergy Overload 11: Increase unit attack by 5 when both units are present on the board', () => {
player1.addAbility(new AdvancedSynergyOverload11());
player2.addAbility(new AdvancedSynergyOverload11());

game.startTurn(player1);
player1.moveUnit(unit1, 0, 0); // Place unit1 on the board
game.startTurn(player2);
player2.moveUnit(unit2, 0, 0); // Place unit2 on the board
game.startTurn(player1);

expect(unit1.attack).to.equal(5); // Unit attack should be increased to 5 due to Synergy Overload 11
});

it('Synergy Overload 11: No effect when only one unit is present on the board', () => {
player1.addAbility(new AdvancedSynergyOverload11());

game.startTurn(player1);
player1.moveUnit(unit1, 0, 0); // Place unit1 on the board
game.startTurn(player2);
player2.moveUnit(unit2, 0, 0); // Place unit2 on the enemy's side
game.startTurn(player1);

expect(unit1.attack).to.equal(1); // Unit attack should not be increased due to only one unit present
});
});
