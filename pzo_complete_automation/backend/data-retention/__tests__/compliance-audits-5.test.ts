import { DataRetentionService } from '../data-retention.service';
import { User, SampleData } from '../models';
import { Injectable, forwardRef, NestJsSpecProvider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnection, Connection } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataRetentionPolicyService } from '../data-retention-policy.service';

describe('DataRetentionService', () => {
let dataRetentionService: DataRetentionService;
let dataRetentionPolicyService: DataRetentionPolicyService;
let connection: Connection;

beforeAll(async () => {
const moduleRef = await Test.createTestingModule({
providers: [
DataRetentionService,
DataRetentionPolicyService,
{
provide: getConnection,
useValue: createMock<Connection>(),
},
],
}).compile();

dataRetentionService = moduleRef.get(DataRetentionService);
dataRetentionPolicyService = moduleRef.get(DataRetentionPolicyService);
connection = moduleRef.get(getConnection);
});

describe('deleteOldData', () => {
it('should delete users older than the policy retention period', async () => {
// Prepare data
await connection.createQueryBuilder(User, 'user')
.insert()
.values([
{ id: 1, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // User older than the policy retention period
{ id: 2, createdAt: new Date(Date.now()) }, // Fresh user
])
.execute();

// Mock policy
dataRetentionPolicyService.getPolicy.mockReturnValueOnce({ days: 1 });

// Call the method under test
await dataRetentionService.deleteOldData();

// Verify that only one user remains in the database
const users = await connection.createQueryBuilder(User).getMany();
expect(users.length).toEqual(1);
});
});

describe('purgeDeletedUsers', () => {
it('should remove deleted users from the database', async () => {
// Prepare data and mark a user as deleted
await connection.createQueryBuilder(User, 'user')
.insert()
.values([{ id: 1, deletedAt: new Date(Date.now()) }])
.execute();

const usersBeforePurge = await connection.createQueryBuilder(User).getMany();
expect(usersBeforePurge.length).toEqual(1);

// Call the method under test
await dataRetentionService.purgeDeletedUsers();

// Verify that the deleted user has been removed from the database
const usersAfterPurge = await connection.createQueryBuilder(User).getMany();
expect(usersAfterPurge.length).toEqual(0);
});
});
});
