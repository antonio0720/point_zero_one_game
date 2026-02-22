import { Pool } from 'pg';

const pool = new Pool({
user: '<your_username>',
host: '<your_host>',
database: '<your_database>',
password: '<your_password>',
port: <your_port>,
});

export async function query(sql: string, params?: any[]) {
return pool.query(sql, params);
}

export async function queryOne(sql: string, params?: any[]) {
const result = await query(sql, params);
return result.rows[0];
}

export async function queryRow(sql: string, params?: any[]) {
const result = await query(sql, params);
if (result.rowCount === 0) {
throw new Error('No rows found');
}
return result.rows[0];
}

export async function queryRows(sql: string, params?: any[]) {
const result = await query(sql, params);
if (result.rowCount === 0) {
return [];
}
return result.rows;
}
