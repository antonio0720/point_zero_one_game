import { Pool } from 'pg';

const pool = new Pool({
user: 'your_database_user',
host: 'localhost',
database: 'your_database_name',
password: 'your_database_password',
port: 5432,
});

export async function query(sql: string, params?: any[]): Promise<any[]> {
const client = await pool.connect();
try {
const result = await client.query(sql, params);
return result.rows;
} catch (err) {
throw err;
} finally {
client.release();
}
}

export async function queryOne(sql: string, params?: any[]): Promise<any> {
const rows = await query(sql, params);
return rows[0];
}

export async function execute(sql: string, params?: any[]): Promise<void> {
const client = await pool.connect();
try {
await client.query(sql, params);
} catch (err) {
throw err;
} finally {
client.release();
}
}
