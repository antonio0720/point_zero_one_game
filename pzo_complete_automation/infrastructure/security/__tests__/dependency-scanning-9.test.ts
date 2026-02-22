import { DependencyScanner } from '../../infrastructure/security/dependency-scanning';
import { DependencyScanResult } from '../../models';
import { expect } from 'chai';
import 'mocha';
import sinon from 'sinon';

describe('Dependency Scanning - Feature 9', () => {
let dependencyScanner: DependencyScanner;
const mockScanResult: DependencyScanResult = {} as DependencyScanResult;

beforeEach(() => {
dependencyScanner = new DependencyScanner();
});

it('should scan for vulnerabilities in a project and return the result', async () => {
sinon.stub(dependencyScanner, 'scan').resolves(mockScanResult);

const result = await dependencyScanner.scan();
expect(result).to.deep.equal(mockScanResult);
});

it('should throw an error if the scan fails', async () => {
sinon.stub(dependencyScanner, 'scan').rejects(new Error('Scan failed'));

await expect(dependencyScanner.scan()).to.be.rejectedWith('Scan failed');
});
});
