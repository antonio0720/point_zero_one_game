import { prisma } from '../../../generated/prisma-client';
import { OutboxMessage, OutboxMessageEvent, OutboxPatternEvent } from '../../outbox';

export async function up() {
await prisma.$executeRaw`
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
`;

await prisma.$executeRaw`
CREATE TYPE outbox_message_event AS ENUM (
'created',
'updated',
'deleted'
);
`;

await prisma.$executeRaw`
CREATE TABLE IF NOT EXISTS outbox_messages (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
event_type VARCHAR(255) NOT NULL,
payload JSONB,
version INTEGER DEFAULT 0,
status VARCHAR(255) DEFAULT 'queued',
sent_at TIMESTAMP WITH TIME ZONE,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

await prisma.$executeRaw`
CREATE TABLE IF NOT EXISTS outbox_message_events (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
message_id UUID NOT NULL,
event_type outbox_message_event NOT NULL,
payload JSONB,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
FOREIGN KEY (message_id) REFERENCES outbox_messages(id) ON DELETE CASCADE
);
`;
}

export async function down() {
await prisma.$executeRaw`
DROP TABLE IF EXISTS outbox_message_events;
`;

await prisma.$executeRaw`
DROP TABLE IF EXISTS outbox_messages;
`;
}

export const outboxPattern8: OutboxPatternEvent = {
up,
down,
};
