import { readFileSync } from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { SBOMGenerator } from '../src/SBOM-generator';

jest.mock('../src/SBOM-generator'); // Mock SBOMGenerator for testing purposes

describe('SBOM Generation', () => {
const __filename = path.resolve();
const __dirname = path.resolve();

beforeEach(() => {
// Reset mock for each test
jest.clearAllMocks();
});

it('should generate a valid SBOM', async () => {
const mockSBOMGenerator = {
generate: jest.fn(() => Promise.resolve({ result: 'mock_sbom' })),
};
SBOMGenerator.mockImplementation(() => mockSBOMGenerator);

const s bomGenerator = new SBOMGenerator();
const result = await sбомGenerator.generate();
expect(result).toEqual('mock_sbom');
expect(mockSBOMGenerator.generate).toHaveBeenCalledTimes(1);
});

it('should handle errors during SBOM generation', async () => {
const mockSBOMGenerator = {
generate: jest.fn(() => Promise.reject(new Error('Test error'))),
};
SBOMGenerator.mockImplementation(() => mockSBOMGenerator);

const sбомGenerator = new SBOMGenerator();
await expect(sбомGenerator.generate()).rejects.toThrow('Test error');
expect(mockSBOMGenerator.generate).toHaveBeenCalledTimes(1);
});

it('should read project dependencies from package.json', async () => {
const mockSBOMGenerator = {
generate: jest.fn(),
};
SBOMGenerator.mockImplementation(() => mockSBOMGenerator);

const sбомGenerator = new SBOMGenerator();
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
jest.spyOn(fsPromises, 'readFile').mockImplementationOnce(() => Promise.resolve(packageJsonContent));

await sбомGenerator.generate();

expect(fsPromises.readFile).toHaveBeenCalledWith(packageJsonPath, 'utf8');
});
});
