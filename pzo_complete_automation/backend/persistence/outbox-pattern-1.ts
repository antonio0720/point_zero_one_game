import { DataSource } from "typeorm";
import { OutboxEntity } from "./entities/OutboxEntity";
import { MessageEntity } from "./entities/MessageEntity";

const dataSource = new DataSource({
type: "postgres",
host: process.env.DB_HOST,
port: Number(process.env.DB_PORT),
username: process.env.DB_USERNAME,
password: process.env.DB_PASSWORD,
database: process.env.DB_DATABASE,
synchronize: true, // Set to false in production for better performance
logging: false, // Set to true in development for debugging purposes
entities: [OutboxEntity, MessageEntity],
});

async function saveMessage(message: any) {
await dataSource.query(`INSERT INTO messages (payload, headers, correlation_id) VALUES ('${JSON.stringify(
message.payload
)}', '${JSON.stringify(message.headers)}', '${message.correlationId}')`);
}

async function markMessageAsSent(correlationId: string) {
await dataSource.query(`UPDATE outbox SET status = 'sent' WHERE correlation_id = '${correlationId}'`);
}

async function publishMessages() {
const messages = await dataSource.query(`SELECT * FROM messages WHERE status = 'unsent'`);

for (const message of messages) {
try {
// Replace this with your actual event publisher logic
console.log("Publishing message:", message);
await markMessageAsSent(message.correlation_id);
} catch (error) {
console.error(`Error while publishing message: ${error}`);
await markMessageAsFailed(message.correlation_id, error.message);
}
}
}

async function markMessageAsFailed(correlationId: string, errorMessage: string) {
await dataSource.query(`UPDATE outbox SET status = 'failed', error_message = '${errorMessage}' WHERE correlation_id = '${correlationId}'`);
}

export { saveMessage, publishMessages };
