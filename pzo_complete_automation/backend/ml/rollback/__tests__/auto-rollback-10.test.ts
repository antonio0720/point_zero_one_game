import { expect } from 'chai';
import sinon from 'sinon';
import { AutoRollback10 } from '../auto-rollback-10';

describe('AutoRollback10', () => {
let autoRollback: AutoRollback10;
let killSwitchSpy: sinon.SinonSpy;

beforeEach(() => {
killSwitchSpy = sinon.spy();
autoRollback = new AutoRollback10(killSwitchSpy);
});

it('should perform rollback if kill switch is triggered', () => {
const model = { save: sinon.fake.resolves() };
const data = { someData: 'someValue' };

sinon.stub(autoRollback, 'getModel').returns(model);
sinon.stub(autoRollback, 'getData').returns(data);
sinon.stub(autoRollback, 'rollback').resolves();

killSwitchSpy.withArgs(sinon.any).returns(true);

return autoRollback.execute().then(() => {
expect(model.save).to.have.been.calledOnceWith(data);
expect(autoRollback.rollback).to.have.been.calledOnce;
});
});

it('should not perform rollback if kill switch is not triggered', () => {
const model = { save: sinon.fake.resolves() };
const data = { someData: 'someValue' };

sinon.stub(autoRollback, 'getModel').returns(model);
sinon.stub(autoRollback, 'getData').returns(data);
sinon.stub(autoRollback, 'rollback').resolves();

killSwitchSpy.withArgs(sinon.any).returns(false);

return autoRollback.execute().then(() => {
expect(model.save).to.have.been.calledOnceWith(data);
expect(autoRollback.rollback).not.to.have.been.called;
});
});
});
