import { MigrationInterface, QueryBuilder } from 'typeorm';

export class InitialMigration1643702498001 implements MigrationInterface {
public async up(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.createTable(
'users',
{
id: {
type: 'uuid',
isPrimary: true,
generationStrategy: 'uuid',
default: () => 'uuid_generate_v4()',
},
firstName: {
type: 'varchar',
length: 50,
nullable: false,
},
lastName: {
type: 'varchar',
length: 50,
nullable: false,
},
email: {
type: 'varchar',
length: 100,
unique: true,
nullable: false,
},
passwordHash: {
type: 'text',
nullable: false,
},
createdAt: {
type: 'timestamp with time zone',
default: () => 'now()',
},
updatedAt: {
type: 'timestamp with time zone',
default: () => 'now()',
},
},
);
}

public async down(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.dropTable('users');
}
}
