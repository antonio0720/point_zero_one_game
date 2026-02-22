import { MigrationInterface, QueryBuilder } from 'typeorm';
import { OutboxMessage } from './entities/OutboxMessage';

export class OutboxPattern41670298358 implements MigrationInterface {
public async up(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.createTable(
OutboxMessage,
{
id: {
type: 'uuid',
isPrimary: true,
generationStrategy: 'uuid',
default: () => 'uuid_generate_v4()',
},
messageId: 'uuid',
eventName: 'varchar(255)',
eventData: 'jsonb',
expiresAt: 'timestamp with time zone',
createdAt: 'timestamp with time zone default now()',
updatedAt: 'timestamp with time zone default now()',
},
);
}

public async down(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.dropTable(OutboxMessage);
}
}
