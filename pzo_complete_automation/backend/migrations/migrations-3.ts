import { MigrationInterface, QueryBuilder } from 'typeorm';

export class CreateUsers1638472056090 implements MigrationInterface {
public async up(queryBuilder: QueryBuilder): Promise<void> {
await queryBuilder.createTable('users', (table) => {
table
.column('id', { type: 'uuid', primary: true, generated: 'uuid' })
.column('username', { type: 'varchar', length: 50, unique: true })
.column('email', { type: 'varchar', length: 255, unique: true })
.column('password', { type: 'text' }) // consider hashing passwords
.column('firstName', { type: 'varchar', length: 100 })
.column('lastName', { type: 'varchar', length: 100 })
.column('createdAt', { type: 'timestamp', default: new Date() })
.column('updatedAt', { type: 'timestamp', default: () => 'NOW()' });
});
}

public async down(queryBuilder: QueryBuilder): Promise<void> {
await queryBuilder.dropTable('users');
}
}
