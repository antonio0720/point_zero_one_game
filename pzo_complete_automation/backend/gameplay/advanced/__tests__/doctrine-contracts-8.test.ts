import { createConnection } from 'typeorm';
import { expect } from '@jest/globals';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ObjectLiteral } from 'typeorm/common/RuntimeTypes';
import { IEntityRepository } from 'doctrine-types';

// Your custom entity that will be tested
@Entity()
class TestEntity {
@PrimaryGeneratedColumn()
id: number;

@Column({ type: 'varchar' })
name: string;
}

describe('Doctrine Contracts 8 Tests', () => {
let connection: any;

beforeAll(async () => {
connection = await createConnection();
await connection.synchronize();
});

afterAll(async () => {
if (connection) await connection.close();
});

it('should create a TestEntity', async () => {
const testEntityRepository: IEntityRepository<TestEntity> = connection.getRepository(TestEntity);

const newTestEntity = new TestEntity();
newTestEntity.name = 'Test Entity';

await testEntityRepository.save(newTestEntity);
const savedTestEntity = await testEntityRepository.findOne({ where: { id: newTestEntity.id } });

expect(savedTestEntity).toBeDefined();
expect(savedTestEntity?.name).toEqual('Test Entity');
});

it('should find a TestEntity by ID', async () => {
const testEntityRepository: IEntityRepository<TestEntity> = connection.getRepository(TestEntity);

// Assuming you already have some TestEntity in the database
const savedTestEntity: ObjectLiteral = await testEntityRepository.findOne({ where: { id: 1 } });

expect(savedTestEntity).toBeDefined();
expect(savedTestEntity?.id).toEqual(1);
});
});
