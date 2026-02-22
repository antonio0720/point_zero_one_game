import * as knex from 'knex';

const db = knex({
client: 'pg',
connection: {
host: 'your_host',
user: 'your_user',
password: 'your_password',
database: 'your_database'
}
});

export async function up(knex: knex.Knex) {
return knex.schema.createTable('users', (table) => {
table.increments('id');
table.string('username').notNullable();
table.string('email').notNullable().unique();
table.timestamps(true, true);
});
}

export async function down(knex: knex.Knex) {
return knex.schema.dropTable('users');
}
