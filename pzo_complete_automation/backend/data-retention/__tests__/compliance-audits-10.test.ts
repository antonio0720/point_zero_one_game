import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionService } from './data-retention.service';
import { getRepositoryToken, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataEntity } from '../entities/data.entity';

describe('DataRetentionService', () => {
let service: DataRetentionService;
let repository: Repository<DataEntity>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [DataRetentionService,
{ provide: getRepositoryToken(DataEntity), useClass: Repository }],
}).compile();

service = module.get<DataRetentionService>(DataRetentionService);
repository = module.get<Repository<DataEntity>>(getRepositoryToken(DataEntity));
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('retainData', () => {
it('should retain data older than the retention period', async () => {
// Arrange
const now = new Date();
const data1 = new DataEntity();
data1.createdAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
const data2 = new DataEntity();
data2.createdAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

repository.save([data1, data2]);

jest.spyOn(repository, 'createQueryBuilder').mockReturnThis();
jest.spyOn(repository.queryBuilder, 'andWhere').mockReturnThis();
jest.spyOn(repository.queryBuilder, 'orderBy').mockReturnThis();
jest.spyOn(repository.queryBuilder, 'take').mockReturnThis();
jest.spyOn(repository.queryBuilder, 'getManyAndCount').mockResolvedValue({ data: [data1], count: 1 });

// Act
await service.retainData();

// Assert
expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
expect(repository.queryBuilder.andWhere).toHaveBeenCalledWith('createdAt <= :date', { date: now.setDate(now.getDate() - 7) }); // retention period of 7 days
expect(repository.queryBuilder.orderBy).toHaveBeenCalledWith('createdAt', 'ASC');
expect(repository.queryBuilder.take).toHaveBeenCalledWith(10);
expect(repository.getRepository(DataEntity).create).not.toHaveBeenCalled();
});
});

describe('deleteOldData', () => {
it('should delete data older than the retention period', async () => {
// Arrange
const now = new Date();
const data1 = new DataEntity();
data1.createdAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
const data2 = new DataEntity();
data2.createdAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

repository.save([data1, data2]);

jest.spyOn(repository, 'createQueryBuilder').mockReturnThis();
jest.spyOn(repository.queryBuilder, 'andWhere').mockReturnThis();
jest.spyOn(repository.queryBuilder, 'delete').mockResolvedValue({ affected: 1 });

// Act
await service.deleteOldData();

// Assert
expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
expect(repository.queryBuilder.andWhere).toHaveBeenCalledWith('createdAt <= :date', { date: now.setDate(now.getDate() - 7) }); // retention period of 7 days
expect(repository.queryBuilder.delete).toHaveBeenCalledTimes(2); // one for each data entity
});
});
});
