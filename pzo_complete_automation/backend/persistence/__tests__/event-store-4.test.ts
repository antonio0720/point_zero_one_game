import { Injectable, NotFoundException } from '@nestjs/common';
import { EventStore, IEvent } from 'event-store';
import { Test, TestingModule } from '@nestjs/testing';
import { EventStore4Service } from './event-store-4.service';
import { Event1 } from '../../events/event1.entity';
import { Event2 } from '../../events/event2.entity';

describe('EventStore4Service', () => {
let service: EventStore4Service;
let eventStore: EventStore;

beforeEach(async () => {
const module = await Test.createTestingModule({
providers: [EventStore4Service],
}).compile();

service = module.get<EventStore4Service>(EventStore4Service);
eventStore = service.eventStore;
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('saveEvent', () => {
it('should save an event and return the saved event', async () => {
const event1 = new Event1({ id: '1', data: 'event 1 data' });
const savedEvent = await service.saveEvent(event1);
expect(savedEvent).toEqual(expect.objectContaining(event1));
});

it('should throw an error if the event already exists', async () => {
const event1 = new Event1({ id: '1', data: 'event 1 data' });
await service.saveEvent(event1);

expect(() => service.saveEvent(event1)).toThrowError('Event already exists');
});
});

describe('loadEvent', () => {
it('should load an event by id', async () => {
const event1 = new Event1({ id: '1', data: 'event 1 data' });
await service.saveEvent(event1);
const loadedEvent = await service.loadEvent<Event1>('1');
expect(loadedEvent).toEqual(expect.objectContaining(event1));
});

it('should throw an error if the event does not exist', async () => {
expect(() => service.loadEvent<Event1>('non-existent-id')).toThrowError(NotFoundException);
});
});

describe('loadEventsByAggregateId', () => {
it('should load events for an aggregate by id', async () => {
const event1 = new Event1({ id: '1', data: 'event 1 data', aggregateId: 'aggregate-id' });
const event2 = new Event2({ id: '2', data: 'event 2 data', aggregateId: 'aggregate-id' });

await service.saveEvent(event1);
await service.saveEvent(event2);

const events = await service.loadEventsByAggregateId<Event1>('aggregate-id');
expect(events).toHaveLength(2);
expect(events).toEqual(expect.arrayContaining([expect.objectContaining(event1), expect.objectContaining(event2)]));
});
});
});
