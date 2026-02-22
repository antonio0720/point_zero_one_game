import { explainability13 } from '../explainability-13';
import { Model } from '../../model';
import { Instance } from '@nomic-dream/fast-tensor';
import { expect } from 'chai';
import sinon from 'sinon';

describe('Explainability-13', () => {
let model: Model;
let explainability13Function: any;

beforeEach(() => {
model = new Model();
explainability13Function = sinon.spy(model, 'explainability13');
});

afterEach(() => {
model.explainability13.restore();
});

it('should return an explanation for a given instance', () => {
// Prepare your test data and the expected result here
const instance = new Instance([1, 2, 3]);
const expectedExplanation = [4, 5, 6];

model.predict = sinon.stub().returns(0.5);
model.predictGradient = sinon.stub().returns({ gradient: expectedExplanation });

const explanation = explainability13(instance);
expect(explanation).to.deep.equal(expectedExplanation);
expect(explainability13Function.calledOnceWithExactly(instance)).to.be.true;
});

it('should throw an error if predictGradient returns null', () => {
model.predictGradient = sinon.stub().returns({ gradient: null });

expect(() => explainability13(new Instance([1, 2, 3]))).to.throw('Explanation not available');
expect(explainability13Function.calledOnce).to.be.true;
});
});
