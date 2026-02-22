import { MigrationBuilder } from 'node-db-migrate';

export default class Migration_4 extends MigrationBuilder {
async up() {
this.schema.createTable('users', (table) => {
table.increments('id').primary();
table.string('name');
table.string('email').notNull().unique();
table.timestamp('created_at').defaultTo(this.fn.now());
table.timestamp('updated_at').defaultTo(this.fn.now()).onUpdate(this.fn.now());
});
}

async down() {
this.schema.dropTable('users');
}
}
