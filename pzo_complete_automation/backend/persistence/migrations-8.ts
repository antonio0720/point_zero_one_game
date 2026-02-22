import { MigrationBuilder } from 'typeorm';

export class Migration815709624321 implements MigrationInterface {
public async up(queryRunner: QueryRunner): Promise<void> {
await queryRunner.query(`
CREATE TABLE "user_notifications" (
"id" SERIAL PRIMARY KEY,
"userId" INTEGER NOT NULL REFERENCES "users" ("id"),
"notificationTitle" VARCHAR(255) NOT NULL,
"notificationMessage" TEXT NOT NULL,
"isRead" BOOLEAN DEFAULT false,
"createdAt" TIMESTAMP DEFAULT now(),
"updatedAt" TIMESTAMP DEFAULT now()
)
`);
}

public async down(queryRunner: QueryRunner): Promise<void> {
await queryRunner.query(`DROP TABLE "user_notifications"`);
}
}
