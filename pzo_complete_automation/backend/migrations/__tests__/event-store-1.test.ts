import { EventStore } from "../event-store";
import { InMemoryEventStore } from "../in-memory/in-memory-event-store";
import { IEvent } from "../../domain/IEvent";
import { Uuid } from "uuidv4";
import { expect } from "chai";

describe("EventStore - event-store-1", () => {
let eventStore: EventStore;
const event1: IEvent = {
id: Uuid(),
aggregateId: Uuid(),
type: "ExampleEventType",
createdAt: new Date(),
data: {},
};
const event2: IEvent = {
id: Uuid(),
aggregateId: Uuid(),
type: "AnotherExampleEventType",
createdAt: new Date(),
data: {},
};

beforeEach(() => {
eventStore = new InMemoryEventStore();
});

it("should save an event", async () => {
await eventStore.save(event1);
const savedEvents = await eventStore.load(event1.aggregateId);
expect(savedEvents).to.deep.equal([event1]);
});

it("should load events for an aggregate", async () => {
await eventStore.save(event1);
await eventStore.save(event2);
const loadedEvents = await eventStore.load(event1.aggregateId);
expect(loadedEvents).to.deep.equal([event1]);
});

it("should return empty array if there are no events for an aggregate", async () => {
const loadedEvents = await eventStore.load(Uuid());
expect(loadedEvents).to.be.an("array").and.to.have.lengthOf(0);
});
});
