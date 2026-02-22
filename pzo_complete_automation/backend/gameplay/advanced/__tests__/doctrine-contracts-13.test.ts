import { createConnection } from "typeorm";
import { expect } from "@jest/globals";
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { DoctrineEntityManager } from "@nestjs/typeorm";
import { CreateEntityRepository, Repository } from "@mikro-orm/core";
import { MicroORM } from "@mikro-orm/cli-entity-client";
import { EntityTestHelper } from "./entity-test-helper";

describe("Advanced gameplay - Doctrine Contracts 1.3", () => {
let entityRepository: CreateEntityRepository<TestEntity>;
let microORM: MicroORM;
let em: DoctrineEntityManager;

beforeAll(async () => {
microORM = await MicroORM.init({
entities: [TestEntity],
autoLoadEntities: true,
type: "mysql",
url: process.env.TEST_DATABASE_URL,
});

em = microORM.em.create();
});

afterAll(async () => {
await microORM.close();
});

beforeEach(async () => {
entityRepository = em.getRepository(TestEntity);
await entityRepository.clear();
});

it("should create a new TestEntity and save it", async () => {
const testEntity = new TestEntity();
testEntity.name = "Test Entity";

await entityRepository.persistAndFlush(testEntity);

const savedTestEntity = await entityRepository.findOne({ name: "Test Entity" });
expect(savedTestEntity).toBeDefined();
expect(savedTestEntity?.name).toEqual("Test Entity");
});
});

@Entity()
class TestEntity {
@PrimaryGeneratedColumn()
id!: number;

@Column({ unique: true })
name!: string;
}
