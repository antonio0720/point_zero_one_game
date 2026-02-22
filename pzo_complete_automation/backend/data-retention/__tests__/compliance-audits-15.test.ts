import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionService } from './data-retention.service';
import { ComplianceAudits15Repository } from './compliance-audits-15.repository';
import { getConnectionToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('DataRetentionService', () => {
let service: DataRetentionService;
let repository: ComplianceAudits15Repository;
let jwtService: JwtService;
let configService: ConfigService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
DataRetentionService,
ComplianceAudits15Repository,
{ provide: getConnectionToken(), useValue: {} },
JwtService,
ConfigService,
],
}).compile();

service = module.get<DataRetentionService>(DataRetentionService);
repository = module.get<ComplianceAudits15Repository>(ComplianceAudits15Repository);
jwtService = module.get<JwtService>(JwtService);
configService = module.get<ConfigService>(ConfigService);
});

it('should delete compliance audits older than 15 days', async () => {
// arrange (setup)
const testData = [
// ... your test data here
];

await repository.save(testData);

jest.spyOn(repository, 'find').mockResolvedValue(testData);
jest.spyOn(jwtService, 'sign').mockReturnValue('signedJwt');
jest.spyOn(configService, 'get').mockReturnValue('2022-01-01T00:00:00Z'); // mock current date

// act (call the method being tested)
await service.deleteOldComplianceAudits();

// assert (verify the expected results)
expect(repository.find).toHaveBeenCalledWith({ where: { createdAt: lessThan(new Date('2021-12-31T00:00:00Z')) } });
expect(repository.remove).toHaveBeenCalledWith(expect.arrayContaining([testData[0], testData[1]]));
});
});
