import { MechanicsEditor, Mechanic, Card } from '../src/mechanics-editor-2';
import { expect } from 'chai';

describe('Mechanics Editor 2', () => {
let editor: MechanicsEditor;

beforeEach(() => {
editor = new MechanicsEditor();
});

it('should create a mechanic with no effect', () => {
const mechanic = editor.createMechanic('My Mechanic');
expect(mechanic).to.exist;
expect(mechanic.effect).to.be.undefined;
});

it('should create a mechanic with an effect', () => {
const card = new Card('Test Card');
const mechanic = editor.createMechanic('My Mechanic', (context, _, card) => {
context.addAction({ action: 'Test Action' });
}, [card]);

expect(mechanic).to.exist;
expect(mechanic.effect).to.not.be.undefined;
});

// Add more test cases as needed
});
