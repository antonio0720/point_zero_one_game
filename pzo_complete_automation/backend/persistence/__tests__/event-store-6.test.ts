import { Test, TestingModule } from '@nestjs/testing';
import { EventStore6Service } from './event-store-6.service';
import { EventStore6Client } from 'eventstore-client';
import { ClientConfigureOptions } from 'eventstore-client';
import { EventsRepository } from '../events.repository';
import { Event } from '../../domain/entities/Event';
import { getConnection, Repository } from 'typeorm';
import { faker } from '@faker-js/faker';
import { EventEntity } from '../entities/event.entity';

describe('EventStore6Service', () => {
let service: EventStore6Service;
let client: EventStore6Client;
let repository: Repository<EventEntity>;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [EventStore6Service, EventsRepository],
}).compile();

service = module.get<EventStore6Service>(EventStore6Service);
client = service.client;
repository = getConnection().getRepository(EventEntity);
});

afterEach(async () => {
await repository.clear();
});

describe('append', () => {
it('should append an event and persist it in both EventStore and TypeORM', async () => {
const event = new Event(faker.random.uuid(), faker.datatype.string());

await service.append(event);

const storedEvent = await repository.findOne({ where: { aggregateId: event.aggregateId } });
expect(storedEvent).not.toBeNull();
expect(storedEvent?.data).toEqual(JSON.stringify(event));
expect(client.readstream('from', event.aggregateId, '>')).toThrowError('The stream does not exist yet.');
});
});

describe('read', () => {
it('should read an event from TypeORM', async () => {
const event = new Event(faker.random.uuid(), faker.datatype.string());
await repository.save(event);

const result = await service.read(event.aggregateId, event.streamName);
expect(result).toEqual(event);
});

it('should read an event from EventStore', async () => {
const event = new Event(faker.random.uuid(), faker.datatype.string());
await client.appendToStream(event.aggregateId, event.streamName, event.data);

const result = await service.read(event.aggregateId, event.streamName);
expect(result).toEqual(event);
});
});

describe('readAll', () => {
it('should read all events for an aggregate from TypeORM', async () => {
const firstEvent = new Event(faker.random.uuid(), faker.datatype.string());
await repository.save(firstEvent);

const secondEvent = new Event(faker.random.uuid(), faker.datatype.string());
await repository.save(secondEvent);

const result = await service.readAll(firstEvent.aggregateId);
expect(result).toEqual([firstEvent, secondEvent]);
});

it('should read all events for an aggregate from EventStore', async () => {
const firstEvent = new Event(faker.random.uuid(), faker.datatype.string());
await client.appendToStream(firstEvent.aggregateId, firstEvent.streamName, firstEvent.data);

const secondEvent = new Event(faker.random.uuid(), faker.datatype.string());
await client.appendToStream(secondEvent.aggregateId, secondEvent.streamName, secondEvent.data);

const result = await service.readAll(firstEvent.aggregateId);
expect(result).toEqual([firstEvent, secondEvent]);
});
});
});
