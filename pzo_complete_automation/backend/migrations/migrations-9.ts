import * as knex from 'knex';

export async function up(knex: knex.Knex) {
return knex.schema.createTable('users', (table) => {
table.increments('id').primary();
table.string('firstName', 100).notNullable();
table.string('lastName', 100).notNullable();
table.string('email', 255).unique().notNullable();
table.string('password', 255).notNullable();
table.timestamps(true, true);
});
}

export async function down(knex: knex.Knex) {
return knex.schema.dropTable('users');
}
