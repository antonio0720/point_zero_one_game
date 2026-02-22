import * as knex from 'knex';

export async function up(knex: knex.Knex) {
return knex.schema.createTable('users', (table) => {
table.increments('id');
table.string('username').notNullable();
table.string('email').unique().notNullable();
table.string('password').notNullable();
table.timestamps(true, true);
});
}

export async function down(knex: knex.Knex) {
return knex.schema.dropTable('users');
}
