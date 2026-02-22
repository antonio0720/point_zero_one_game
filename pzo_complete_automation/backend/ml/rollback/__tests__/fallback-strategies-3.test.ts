import { RollbackService } from '../../../backend/ml/rollback';
import { FallbackStrategy1 } from './fallback-strategy-1';
import { FallbackStrategy2 } from './fallback-strategy-2';
import { FallbackStrategy3 } from './fallback-strategy-3';
import { KillSwitchService } from '../../../backend/ml/kill-switch';
import sinon, { stubInterface } from 'sinon';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

describe('ML Rollback + Kill Switch - Fallback Strategies 3', () => {
let rollbackService: RollbackService;
let killSwitchService: KillSwitchService;
let fallbackStrategy1Stub: any;
let fallbackStrategy2Stub: any;
let fallbackStrategy3Stub: any;

beforeEach(() => {
fallbackStrategy1Stub = stubInterface(FallbackStrategy1);
fallbackStrategy2Stub = stubInterface(FallbackStrategy2);
fallbackStrategy3Stub = stubInterface(FallbackStrategy3);

rollbackService = new RollbackService();
killSwitchService = new KillSwitchService();
});

afterEach(() => {
fallbackStrategy1Stub.restore();
fallbackStrategy2Stub.restore();
fallbackStrategy3Stub.restore();
});

describe('when kill switch is OFF', () => {
beforeEach(() => {
killSwitchService.isOff.returns(true);
});

it('should execute the third fallback strategy if the first and second fail', async () => {
// Given
fallbackStrategy1Stub.execute.rejects(new Error('First strategy failed'));
fallbackStrategy2Stub.execute.rejects(new Error('Second strategy failed'));
fallbackStrategy3Stub.execute.resolves();

// When
const result = await rollbackService.rollback();

// Then
expect(fallbackStrategy1Stub.execute).to.have.been.calledOnce;
expect(fallbackStrategy2Stub.execute).to.have.been.calledOnce;
expect(fallbackStrategy3Stub.execute).to.have.been.calledOnce;
expect(result).to.be.fulfilled;
});

it('should execute the second fallback strategy if the first fails and the second succeeds', async () => {
// Given
fallbackStrategy1Stub.execute.rejects(new Error('First strategy failed'));
fallbackStrategy2Stub.execute.resolves();
fallbackStrategy3Stub.execute.resolves();

// When
const result = await rollbackService.rollback();

// Then
expect(fallbackStrategy1Stub.execute).to.have.been.calledOnce;
expect(fallbackStrategy2Stub.execute).to.have.been.calledOnce;
expect(fallbackStrategy3Stub.execute).not.to.have.been.called;
expect(result).to.be.fulfilled;
});

it('should execute the first fallback strategy if none fails', async () => {
// Given
fallbackStrategy1Stub.execute.resolves();
fallbackStrategy2Stub.execute.resolves();
fallbackStrategy3Stub.execute.resolves();

// When
const result = await rollbackService.rollback();

// Then
expect(fallbackStrategy1Stub.execute).to.have.been.calledOnce;
expect(fallbackStrategy2Stub.execute).to.have.been.calledOnce;
expect(fallbackStrategy3Stub.execute).not.to.have.been.called;
expect(result).to.be.fulfilled;
});
});

describe('when kill switch is ON', () => {
beforeEach(() => {
killSwitchService.isOff.returns(false);
});

it('should not execute any fallback strategy when the kill switch is ON', async () => {
// Given
fallbackStrategy1Stub.execute.resolves();
fallbackStrategy2Stub.execute.resolves();
fallbackStrategy3Stub.execute.resolves();

// When
const result = await rollbackService.rollback();

// Then
expect(fallbackStrategy1Stub.execute).not.to.have.been.called;
expect(fallbackStrategy2Stub.execute).not.to.have.been.called;
expect(fallbackStrategy3Stub.execute).not.to.have.been.called;
expect(result).to.be.rejectedWith('Kill switch is ON, rollback is disabled');
});
});
});
