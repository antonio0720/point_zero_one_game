import { Test, TestingModule } from '@nestjs/testing';
import { AuditTrailService } from '../audit-trail.service';
import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailEntity } from '../../entities/audit-trail.entity';
import { GetAuditTrailDto } from '../../dtos/get-audit-trail.dto';
import { AuditTrailRepository } from '../../repositories/audit-trail.repository';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('AuditTrailController', () => {
let controller: AuditTrailController;
let service: AuditTrailService;
let repository: AuditTrailRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [AuditTrailController],
providers: [
AuditTrailService,
{ provide: getRepositoryToken(AuditTrailEntity), useValue: repository },
],
}).compile();

controller = module.get<AuditTrailController>(AuditTrailController);
service = module.get<AuditTrailService>(AuditTrailService);
repository = module.get<AuditTrailRepository>(getRepositoryToken(AuditTrailEntity));
});

it('should be defined', () => {
expect(controller).toBeDefined();
expect(service).toBeDefined();
expect(repository).toBeDefined();
});

describe('getAuditTrail', () => {
const mockGetAuditTrailDto: GetAuditTrailDto = { datasetId: 'test-dataset' };

it('should return audit trail data', async () => {
// arrange
const auditTrailData: AuditTrailEntity[] = [...Array(10)].map((_, i) => ({ id: i + 1, ...mockGetAuditTrailDto }));
repository.find = jest.fn().mockResolvedValue(auditTrailData);

// act
const result = await controller.getAuditTrail(mockGetAuditTrailDto);

// assert
expect(result).toEqual(auditTrailData);
});

it('should handle errors', async () => {
// arrange
repository.find.mockRejectedValue(new Error('Database error'));

// act and assert
await expect(controller.getAuditTrail(mockGetAuditTrailDto)).rejects.toThrow('Database error');
});
});
});
