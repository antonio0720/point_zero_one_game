import { ChoiceDrillGenerator2 } from '../choice-drill-generator-2';
import { expect } from 'chai';
import 'mocha';

describe('ChoiceDrillGenerator2', () => {
describe('#generate()', () => {
it('should generate a choice drill correctly for simple data', () => {
const generator = new ChoiceDrillGenerator2();
const data = [
{ id: 'q1', choices: ['A', 'B'], correctAnswer: 'A' },
{ id: 'q2', choices: ['C', 'D'], correctAnswer: 'C' },
];
const drill = generator.generate(data);
expect(drill).to.deep.equal([
{ questionId: 'q1', answer: 'A' },
{ questionId: 'q2', answer: '' },
]);
});

it('should generate a choice drill correctly for complex data', () => {
const generator = new ChoiceDrillGenerator2();
const data = [
{ id: 'q1', choices: ['A', 'B'], correctAnswer: 'A' },
{ id: 'q2', choices: ['C', 'D'], correctAnswer: 'C' },
{ id: 'q3', choices: ['E', 'F'], correctAnswer: 'E' },
];
const drill = generator.generate(data);
expect(drill).to.deep.equal([
{ questionId: 'q1', answer: 'A' },
{ questionId: 'q2', answer: '' },
{ questionId: 'q3', answer: '' },
]);
});
});
});
