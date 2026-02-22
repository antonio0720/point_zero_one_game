import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, TypeOrmModule } from '@nestjs/typeorm';
import { EventStore } from '../event-store.entity';
import { EventStoreService } from './event-store.service';

describe('EventStoreService', () => {
let service: EventStoreService;
let connection;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [TypeOrmModule.forRoot()],
providers: [EventStoreService],
}).compile();

connection = module.get(getConnectionToken());
await connection.synchronize();

service = module.get<EventStoreService>(EventStoreService);
});

afterAll(async () => {
await connection.close();
});

describe('create', () => {
it('should create a new EventStore', async () => {
const eventStore = await service.create({
id: '123',
aggregateId: '456',
eventType: 'TestEvent',
eventData: JSON.stringify({ test: 'data' }),
version: 1,
timestamp: new Date(),
});

expect(eventStore).toBeInstanceOf(EventStore);
});
});

describe('findOne', () => {
it('should return an EventStore with the given id', async () => {
const eventStore = await service.create({
id: '123',
aggregateId: '456',
eventType: 'TestEvent',
eventData: JSON.stringify({ test: 'data' }),
version: 1,
timestamp: new Date(),
});
await connection.getRepository(EventStore).save(eventStore);

const foundEventStore = await service.findOne('123');

expect(foundEventStore).toBeInstanceOf(EventStore);
expect(foundEventStore?.id).toEqual('123');
});

it('should return null when no EventStore with the given id is found', async () => {
const result = await service.findOne('nonexistentId');

expect(result).toBeNull();
});
});

describe('findMany', () => {
it('should return all EventStores', async () => {
const eventStore1 = await service.create({
id: '123',
aggregateId: '456',
eventType: 'TestEvent',
eventData: JSON.stringify({ test: 'data' }),
version: 1,
timestamp: new Date(),
});
await connection.getRepository(EventStore).save(eventStore1);

const eventStore2 = await service.create({
id: '456',
aggregateId: '789',
eventType: 'TestEvent',
eventData: JSON.stringify({ test: 'data' }),
version: 1,
timestamp: new Date(),
});
await connection.getRepository(EventStore).save(eventStore2);

const foundEventStores = await service.findMany();

expect(foundEventStores.length).toEqual(2);
});
});
});
