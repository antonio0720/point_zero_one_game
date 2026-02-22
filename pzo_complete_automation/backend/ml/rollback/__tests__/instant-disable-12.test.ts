import { instantDisable12 } from '../instant-disable-12';
import { expect } from 'chai';
import sinon from 'sinon';

describe('instantDisable12', () => {
let mockFunction;

beforeEach(() => {
mockFunction = sinon.mock();
});

afterEach(() => {
mockFunction.verify();
mockFunction.restore();
});

it('should enable instant-disable-12 feature when called', () => {
mockFunction.expects('enableFeature').once().withArgs('instant-disable-12');

instantDisable12();
mockFunction.callThrough();
});

it('should do nothing when instant-disable-12 is already enabled', () => {
mockFunction.expects('isFeatureEnabled').once().withArgs('instant-disable-12').returns(true);

instantDisable12();
mockFunction.callThrough();
});
});
