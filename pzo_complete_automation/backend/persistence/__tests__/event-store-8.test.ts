import { EventStore } from '../../src/backend/persistence/event-store';
import { InMemoryEventStore } from '../../src/backend/persistence/in-memory-event-store';
import { DummyAggregate } from '../fixtures/dummy-aggregate';
import { createAggregateFromEvents, AggregateId } from '../../src/backend/domain';
import { Event } from '../../src/backend/domain/event';
import { ofType } from 'rxjs';
import { map, tap, toArray } from 'rxjs/operators';

describe('EventStore', () => {
let eventStore: EventStore;
const aggregateId = AggregateId.generate();

beforeEach(() => {
eventStore = new InMemoryEventStore();
});

it('should save and load events', async () => {
const dummyAggregate = new DummyAggregate(aggregateId);
dummyAggregate.applyEvent(new DummyAggregate.DummyEvent());
await eventStore.save(dummyAggregate);

const loadedAggregate = await eventStore.load(aggregateId);
expect(loadedAggregate).toEqual(dummyAggregate);
});

it('should return events of an aggregate', async () => {
const dummyAggregate = new DummyAggregate(aggregateId);
dummyAggregate.applyEvent(new DummyAggregate.DummyEvent());
await eventStore.save(dummyAggregate);

const events$ = eventStore.eventsOf(aggregateId);
const events = await events$.pipe(toArray()).toPromise();

expect(events).toEqual([dummyAggregate.uncommittedEvents()[0]]);
});

it('should apply events to an aggregate', async () => {
const dummyAggregate = new DummyAggregate(aggregateId);
const events: Event<any>[] = [dummyAggregate.applyEvent(new DummyAggregate.DummyEvent()).event];
await eventStore.save(events);

const loadedAggregate = await eventStore.load(aggregateId);
expect(loadedAggregate).toEqual(createAggregateFromEvents(dummyAggregate.constructor, [events[0]]));
});

it('should return the last committed version of an aggregate', async () => {
const dummyAggregate = new DummyAggregate(aggregateId);
dummyAggregate.applyEvent(new DummyAggregate.DummyEvent());
await eventStore.save(dummyAggregate);

const version = await eventStore.versionOf(aggregateId);
expect(version).toEqual(1);
});
});
