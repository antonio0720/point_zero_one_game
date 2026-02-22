import { EventStore } from "../event-store";
import { InMemoryEventStore } from "../in-memory-event-store";
import { DummyEvent } from "../../domain/events/dummy-event";
import { IEventStore } from "../event-store.interface";

describe("Persistence layer - event-store", () => {
let eventStore: IEventStore;

beforeEach(() => {
eventStore = new InMemoryEventStore();
});

it("should save and load events", async () => {
const dummyEvent1 = new DummyEvent("dummy-id1");
await eventStore.save(dummyEvent1);
const loadedDummyEvent1 = await eventStore.load("dummy-id1");
expect(loadedDummyEvent1).toEqual(dummyEvent1);
});

it("should throw an error when loading non-existent events", async () => {
await expect(eventStore.load("non-existent-id")).rejects.toThrowError();
});

it("should clear the event store", async () => {
const dummyEvent1 = new DummyEvent("dummy-id1");
const dummyEvent2 = new DummyEvent("dummy-id2");
await eventStore.save(dummyEvent1);
await eventStore.save(dummyEvent2);

await eventStore.clear();

const loadedDummyEvent1 = await eventStore.load("dummy-id1");
expect(loadedDummyEvent1).toBeNull();
});
});
