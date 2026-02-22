import { createConnection } from "typeorm";
import { EventStore } from "../event-store";
import { TestEvent } from "../../domain/test-event";
import { TestAggregate } from "../../domain/test-aggregate";
import { faker } from "@faker-js/faker";

describe("Persistence layer - event-store-9", () => {
let connection: any;
let eventStore: EventStore;

beforeAll(async () => {
connection = await createConnection();
eventStore = new EventStore();
});

afterAll(async () => {
await connection.close();
});

it("should save and load events", async () => {
const aggregateId = faker.datatype.uuid();
const testEventData = new TestEvent({
name: faker.name.firstName(),
aggregateId,
timestamp: new Date(),
});

await eventStore.save(TestAggregate, aggregateId, [testEventData]);

const loadedEvents = await eventStore.load(TestAggregate, aggregateId);
expect(loadedEvents[0]).toEqual(testEventData);
});

it("should load an empty list when no events exist", async () => {
const aggregateId = faker.datatype.uuid();
const loadedEvents = await eventStore.load(TestAggregate, aggregateId);
expect(loadedEvents).toHaveLength(0);
});
});
