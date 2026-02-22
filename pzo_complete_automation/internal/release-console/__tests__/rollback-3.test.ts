import { rollback as rollbackFn } from '../../src/release-console';
import * as fs from 'fs';
import * as path from 'path';
import { createSandbox, SinonStub } from 'sinon';
import 'jest';

describe('rollback-3', () => {
let sandbox: any;
let stubFn1: SinonStub;
let stubFn2: SinonStub;

beforeEach(() => {
sandbox = createSandbox();
stubFn1 = sandbox.stub(fs, 'readFileSync');
stubFn2 = sandbox.stub(fs, 'writeFileSync');
});

afterEach(() => {
sandbox.restore();
});

it('should perform rollback-3 operation correctly', () => {
const mockData1 = 'mock data for rollback-3 test case 1';
const mockData2 = 'mock data for rollback-3 test case 2';

stubFn1.withArgs(path.join('test', 'rollback-3-snapshot1.json')).returns(mockData1);
stubFn1.withArgs(path.join('test', 'rollback-3-snapshot2.json')).returns(mockData2);

rollbackFn();

expect(stubFn2).toHaveBeenCalledWith(path.join('releases', 'current'), mockData2);
expect(stubFn1).toHaveBeenCalledThtwice();
});
});
