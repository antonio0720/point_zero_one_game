import { DataSource } from "typeorm";
import { OutboxEventEntity } from "./outbox-event.entity";
import { OutboxMessageEntity } from "./outbox-message.entity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Injectable()
export class OutboxPatternService {
constructor(
@InjectRepository(OutboxEventEntity)
private outboxEventRepository: Repository<OutboxEventEntity>,
@InjectRepository(OutboxMessageEntity)
private outboxMessageRepository: Repository<OutboxMessageEntity>,
private readonly dataSource: DataSource,
) {}

async saveOutboxEvents(events: OutboxEventEntity[]) {
await this.dataSource.transaction(async (transactionalEntityManager) => {
const outboxEventRepo = transactionalEntityManager.getRepository(
OutboxEventEntity,
);
const outboxMessageRepo = transactionalEntityManager.getRepository(
OutboxMessageEntity,
);

await outboxEventRepo.save(events);

for (const event of events) {
const outboxMessage = new OutboxMessageEntity();
outboxMessage.eventId = event.id;
outboxMessage.message = JSON.stringify(event.data);
outboxMessage.retries = 0;
await outboxMessageRepo.save(outboxMessage);
}
});
}

async processOutboxMessages() {
const messages = await this.outboxMessageRepository.find({ where: {} });

for (const message of messages) {
try {
const eventData = JSON.parse(message.message);
await this.publish(eventData);
await this.outboxMessageRepository.remove(message);
} catch (error) {
// Increase retries and save the message back to persistence layer
message.retries += 1;
await this.outboxMessageRepository.save(message);
}
}
}

private async publish(eventData: any) {
// Implement your custom event publisher here
}
}
