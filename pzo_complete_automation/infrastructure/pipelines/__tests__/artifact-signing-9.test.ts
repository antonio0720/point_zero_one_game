import { Test, TestingModule } from '@nestjs/testing';
import { ArtifactSigningService } from '../artifact-signing.service';
import { createTestingStrategies, JestMockFactory } from '@nestjs/testing/schematics';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';

describe('ArtifactSigningService', () => {
let service: ArtifactSigningService;
const mockJwtSign = jest.fn();
const mockFsReadFileSync = jest.fn().mockImplementation(() => Buffer.from('signedArtifact'));
const mockFsWriteFileSync = jest.fn();

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ArtifactSigningService],
})
.overrideProvider(ArtifactSigningService)
.useValue({
sign: mockJwtSign,
readFileSync: mockFsReadFileSync,
writeFileSync: mockFsWriteFileSync,
})
.compile();

service = module.get<ArtifactSigningService>(ArtifactSigningService);
});

describe('sign', () => {
it('should sign the artifact', async () => {
mockJwtSign.mockReturnValue('signedToken');
const result = await service.sign('artifactData');
expect(result).toEqual('signedToken');
expect(mockJwtSign).toHaveBeenCalledWith('artifactData', jwt.sign.options);
});
});

describe('readFileSync', () => {
it('should read a file synchronously', () => {
service.readFileSync(path.join(__dirname, 'fixtures', 'file.txt'));
expect(mockFsReadFileSync).toHaveBeenCalledWith(path.join(__dirname, 'fixtures', 'file.txt'));
});
});

describe('writeFileSync', () => {
it('should write a file synchronously', () => {
service.writeFileSync(path.join(__dirname, 'fixtures', 'file.txt'), 'content');
expect(mockFsWriteFileSync).toHaveBeenCalledWith(path.join(__dirname, 'fixtures', 'file.txt'), 'content');
});
});
});
