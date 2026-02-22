import * as Knex from 'knex';

export async function up(knex: Knex) {
return knex.schema.createTable('users', (table) => {
table.increments('id').primary();
table.string('username').notNullable();
table.string('email').unique().notNullable();
table.string('password'); // consider storing hashed and salted passwords for security
table.timestamp('created_at').defaultTo(Knex.fn.now());
table.timestamp('updated_at').defaultTo(Knex.fn.now()).onUpdate(Knex.fn.now());
});
}

export async function down(knex: Knex) {
return knex.schema.dropTable('users');
}
