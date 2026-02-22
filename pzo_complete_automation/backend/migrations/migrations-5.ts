import { MigrationInterface, QueryBuilder } from 'typeorm';

export default class CreateUsersTable implements MigrationInterface {
public async up(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.createTable(
new Table({
name: 'users',
columns: [
new Column({
name: 'id',
type: 'uuid',
isPrimary: true,
generationStrategy: 'uuid',
default: 'uuid_generate_v4()',
}),
new Column({
name: 'username',
type: 'varchar',
}),
new Column({
name: 'email',
type: 'varchar',
}),
new Column({
name: 'password_hash',
type: 'text',
}),
new TimestampColumn({
name: 'created_at',
}),
new TimestampColumn({
name: 'updated_at',
}),
],
}),
true,
);
}

public async down(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.dropTable('users');
}
}
