import { MigrationInterface, QueryBuilder } from 'typeorm';

export class Migrations7 implements MigrationInterface {
public async up(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.query(`
CREATE TABLE IF NOT EXISTS users (
id SERIAL PRIMARY KEY,
username VARCHAR(50) NOT NULL UNIQUE,
email VARCHAR(100) NOT NULL UNIQUE,
password_hash TEXT NOT NULL,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
)
`);
}

public async down(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.query(`DROP TABLE users CASCADE`);
}
}
