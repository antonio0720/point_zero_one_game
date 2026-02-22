import { EventStore } from "../event-store";
import { InMemoryEventStore } from "./in-memory-event-store";
import { DummyEvent } from "../../domain/events/dummy-event";

describe("Persistence layer - event-store-2", () => {
let eventStore: EventStore;

beforeEach(() => {
eventStore = new InMemoryEventStore();
});

it("should save an event and retrieve it later", async () => {
const event = new DummyEvent("1");
await eventStore.save(event);

const retrievedEvent = await eventStore.load("1");
expect(retrievedEvent).toEqual(event);
});

it("should save multiple events and retrieve them in order", async () => {
const event1 = new DummyEvent("1");
const event2 = new DummyEvent("2");

await eventStore.save(event1);
await eventStore.save(event2);

const retrievedEvents = await eventStore.loadAll();
expect(retrievedEvents).toEqual([event1, event2]);
});
});
