import { DataSource } from "typeorm";
import { Event, EventEntity } from "../domain/event";
import { OutboxMessage, OutboxMessageEntity } from "../domain/outbox-message";
import { OutboxQueueEntity } from "./outbox-queue.entity";

export const createOutboxRepository = (dataSource: DataSource) => {
dataSource.createEntityFactory(EventEntity);
dataSource.createEntityFactory(OutboxMessageEntity);
dataSource.createEntityFactory(OutboxQueueEntity);

const eventRepository = dataSource.getRepository(EventEntity);
const outboxMessageRepository = dataSource.getRepository(OutboxMessageEntity);
const outboxQueueRepository = dataSource.getRepository(OutboxQueueEntity);

const saveEventAndAddToOutbox = async (event: Event) => {
await eventRepository.save(event);
const outboxMessage = new OutboxMessage(event.id, event.version);
await outboxMessageRepository.save(outboxMessage);
await outboxQueueRepository.save({ message: JSON.stringify(outboxMessage) });
};

const publishOutboxMessages = async () => {
const messages = await outboxQueueRepository.find();
for (const message of messages) {
const jsonMessage = JSON.parse(message.message);
const outboxMessage = outboxMessageRepository.create(jsonMessage);
const event = await eventRepository.findOne(outboxMessage.eventId, { relations: ["aggregate"] });
if (event && event.version === outboxMessage.version) {
await eventRepository.merge(event, outboxMessage.apply());
await eventRepository.save(event);
await outboxMessageRepository.remove(outboxMessage);
}
}
};

return {
saveEventAndAddToOutbox,
publishOutboxMessages,
};
};
