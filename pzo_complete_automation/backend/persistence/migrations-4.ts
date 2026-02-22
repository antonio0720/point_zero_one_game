import { MigrationInterface, QueryBuilder } from 'typeorm';

export class Migration4 implements MigrationInterface {
public async up(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.query(`
ALTER TABLE users
ADD COLUMN new_column varchar(255) DEFAULT null;
`);
}

public async down(queryRunner: QueryBuilder): Promise<void> {
await queryRunner.query(`
ALTER TABLE users
DROP COLUMN new_column;
`);
}
}
