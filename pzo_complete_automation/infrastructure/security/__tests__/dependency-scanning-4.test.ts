import { DependencyScanner } from '../../src/infrastructure/security/DependencyScanner';
import { scanDependenciesSync } from '../../src/infrastructure/security/dependency-scanning-4';
import { PackageJson } from 'typed-json-query';
import fs from 'fs';
import path from 'path';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

describe('Dependency Scanning - dependency-scanning-4', () => {
let dependencyScanner: DependencyScanner;
const sampleProjectPath = path.join(__dirname, 'sample-project');

beforeEach(() => {
dependencyScanner = new DependencyScanner();
});

it('should scan dependencies correctly', async () => {
const packageJson = JSON.parse(fs.readFileSync(path.join(sampleProjectPath, 'package.json'), 'utf8')) as PackageJson;
sinon.stub(dependencyScanner, 'getPackageJson').returns(packageJson);

const result = await scanDependenciesSync(dependencyScanner, sampleProjectPath);

expect(result).to.include.all.keys(['vulnerabilities', 'devDependencies', 'peerDependencies']);
});

it('should return an empty vulnerabilities array when no vulnerabilities are found', async () => {
const packageJson = {
dependencies: {},
};
sinon.stub(dependencyScanner, 'getPackageJson').returns(packageJson);

const result = await scanDependenciesSync(dependencyScanner, sampleProjectPath);

expect(result.vulnerabilities).to.be.empty;
});

// Add more test cases as needed...
});
