import { AutomatedDeletionService } from '../automated-deletion.service';
import { DataEntity } from '../../entities/data.entity';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataRetentionConfigService } from '../../configs/data-retention.config.service';

describe('AutomatedDeletionService', () => {
let service: AutomatedDeletionService;
let dataEntityRepository: Repository<DataEntity>;
let dataRetentionConfigService: DataRetentionConfigService;

beforeEach(async () => {
const module = await Test.createTestingModule({
providers: [
AutomatedDeletionService,
{ provide: getRepositoryToken(DataEntity), useValue: {} },
DataRetentionConfigService,
],
}).compile();

service = module.get<AutomatedDeletionService>(AutomatedDeletionService);
dataEntityRepository = module.get<Repository<DataEntity>>(
getRepositoryToken(DataEntity),
);
dataRetentionConfigService = module.get<DataRetentionConfigService>(
DataRetentionConfigService,
);
});

it('should delete expired data entities', async () => {
// Prepare the test data and set retention period
const now = new Date();
const retentionPeriodInDays = 3;
dataRetentionConfigService.retentionPeriodInDays = retentionPeriodInDays;
const expiredDataEntity = new DataEntity();
expiredDataEntity.createdAt = new Date(now.getTime() - retentionPeriodInDays * 24 * 60 * 60 * 1000);
dataEntityRepository.save(expiredDataEntity);

const nonExpiredDataEntity = new DataEntity();
nonExpiredDataEntity.createdAt = new Date();
dataEntityRepository.save(nonExpiredDataEntity);

// Test the deletion
await service.deleteExpiredDataEntities();

// Verify that the expired data entity has been deleted and non-expired one is still there
const allDataEntities = await dataEntityRepository.find();
expect(allDataEntities.length).toEqual(1);
expect(allDataEntities[0].id).not.toEqual(expiredDataEntity.id);
});

});
