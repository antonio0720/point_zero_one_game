import { Test, TestingModule } from '@nestjs/testing';
import { EventStore3Service } from './event-store-3.service';
import { EventStore3Module } from './event-store-3.module';
import { EventStore3Repository } from './event-store-3.repository';
import { Event } from '../../domain/event.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { INestApplication } from '@nestjs/common';

describe('EventStore3Service', () => {
let app: INestApplication;
let eventStore3Service: EventStore3Service;
let eventStore3Repository: EventStore3Repository;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [EventStore3Module],
}).compile();

app = moduleFixture.createNestApplication();
eventStore3Service = moduleFixture.get<EventStore3Service>(EventStore3Service);
eventStore3Repository = moduleFixture.get<EventStore3Repository>(getRepositoryToken(Event));
await app.init();
});

afterAll(async () => {
await app.close();
});

describe('save', () => {
it('should save an event', async () => {
const event = new Event({
aggregateId: 'aggregate1',
eventName: 'TestEvent',
eventData: {},
version: 1,
occurredOn: new Date(),
});

await eventStore3Service.save(event);

const savedEvent = await eventStore3Repository.findOne({ where: { aggregateId: 'aggregate1' } });
expect(savedEvent).toEqual(expect.objectContaining(event));
});
});

describe('loadEvents', () => {
it('should load events for an aggregate', async () => {
const event1 = new Event({
aggregateId: 'aggregate1',
eventName: 'TestEvent1',
eventData: {},
version: 1,
occurredOn: new Date(),
});
const event2 = new Event({
aggregateId: 'aggregate1',
eventName: 'TestEvent2',
eventData: {},
version: 2,
occurredOn: new Date(),
});

await eventStore3Repository.save(event1);
await eventStore3Repository.save(event2);

const events = await eventStore3Service.loadEvents('aggregate1');
expect(events).toHaveLength(2);
expect(events).toEqual(expect.arrayContaining([expect.objectContaining(event1), expect.objectContaining(event2)]));
});
});
});
