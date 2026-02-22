import { MigrationInterface, QueryBuilder } from 'typeorm';

export class AddUserTable implements MigrationInterface {
name = 'AddUserTable';

public async up(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.query(`
CREATE TABLE "users" (
id SERIAL PRIMARY KEY,
username VARCHAR(255) NOT NULL UNIQUE,
email VARCHAR(255) NOT NULL UNIQUE,
password_hash VARCHAR(255) NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
`);
}

public async down(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.query(`DROP TABLE "users"`);
}
}
