import * as _ from 'lodash';
import * as mocha from 'mocha';
import * as chai from 'chai';
import * as sinon from 'sinon';

const { describe, it } = mocha;
const expect = chai.expect;

describe('Soak Tests 2', function () {
let mockFunction;

beforeEach(function () {
mockFunction = sinon.mock(globalThis).expects('myFunction').anyNumberOfTimes();
});

it('should run myFunction multiple times under load', async function () {
for (let i = 0; i < 1000; i++) {
globalThis.myFunction();
}

mockFunction.verify();
});

it('should handle chaos by randomly failing myFunction calls', function () {
const failSpy = sinon.spy(globalThis, 'myFunction');

_.times(100, function (n) {
if (_.random(0, 10) < 5) {
failSpy.rejects = new Error('Chaos injected');
} else {
failSpy();
}
});
});
});
