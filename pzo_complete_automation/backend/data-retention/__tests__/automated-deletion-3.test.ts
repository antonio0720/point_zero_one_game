import { AutomatedDeletionService } from '../services/automated-deletion.service';
import { DataRetentionRepository } from '../repositories/data-retention.repository';
import { User } from '../../users/entities/user.entity';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { getConnectionToken, Connection } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionEntity } from '../entities/data-retention.entity';

describe('AutomatedDeletionService', () => {
let service: AutomatedDeletionService;
let repository: DataRetentionRepository;
let connection: Connection;

beforeAll(async () => {
const module = await Test.createTestingModule({
providers: [
AutomatedDeletionService,
DataRetentionRepository,
{
provide: getConnectionToken(),
useValue: new Connection()
},
{
provide: User,
useValue: {},
},
],
}).compile();

service = module.get<AutomatedDeletionService>(AutomatedDeletionService);
repository = module.get<DataRetentionRepository>(DataRetentionRepository);
connection = module.get<Connection>(getConnectionToken());
});

describe('deleteOlderThan', () => {
it('should delete data retention records older than the specified date', async () => {
// Arrange
const dataRetention1 = new DataRetentionEntity();
dataRetention1.createdAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
dataRetention1.user = {} as User;

const dataRetention2 = new DataRetentionEntity();
dataRetention2.createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
dataRetention2.user = {} as User;

await repository.save([dataRetention1, dataRetention2]);

const deletedCountBeforeDeletion = await repository.count({ createdAt: LessThan(new Date()) });

// Act
await service.deleteOlderThan(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)); // 6 days ago

// Assert
const deletedCountAfterDeletion = await repository.count({ createdAt: LessThan(new Date()) });
expect(deletedCountAfterDeletion).toEqual(deletedCountBeforeDeletion - 2);
});
});
});
