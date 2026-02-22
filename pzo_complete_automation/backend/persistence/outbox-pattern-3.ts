import { DataSource } from 'typeorm';
import { RedisClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

export class OutboxRepository {
private dataSource: DataSource;
private redisClient: RedisClient;

constructor(dataSource: DataSource, redisClient: RedisClient) {
this.dataSource = dataSource;
this.redisClient = redisClient;
}

async enqueueMessage(message: any): Promise<void> {
const id = uuidv4();
await this.dataSource.query(`
INSERT INTO outbox_messages (id, message, created_at)
VALUES ('${id}', '${JSON.stringify(message)}', NOW())
`);
await this.redisClient.rpush(`outbox:${process.env.NODE_ENV}`, JSON.stringify({ id, message }));
}

async processOutbox(): Promise<void> {
const outboxMessages = await this.redisClient.lrange(`outbox:${process.env.NODE_ENV}`, 0, -1);

for (const message of outboxMessages) {
const jsonMessage = JSON.parse(message);
const messageId = jsonMessage.id;
const outboxMessage = await this.dataSource.query(`SELECT * FROM outbox_messages WHERE id = '${messageId}' FOR UPDATE`);

if (outboxMessage.length > 0) {
try {
await this.handleMessage(jsonMessage.message);
await this.dataSource.query(`DELETE FROM outbox_messages WHERE id = '${messageId}'`);
} catch (error) {
console.error(`Failed to handle message with ID ${messageId}. Error:`, error);
}
} else {
console.warn(`Skipped outdated message with ID ${messageId}`);
}
}
}

async handleMessage(message: any): Promise<void> {} // Implement your message handling logic here
}
