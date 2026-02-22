import { Pool } from 'pg';

const pool = new Pool({
user: 'your_database_user',
host: 'localhost',
database: 'your_database_name',
password: 'your_database_password',
port: 5432,
});

interface User {
id: number;
name: string;
}

async function createTable() {
await pool.query(`
CREATE TABLE IF NOT EXISTS users (
id SERIAL PRIMARY KEY,
name VARCHAR(255) NOT NULL
)
`);
}

async function insertUser(user: User): Promise<void> {
await pool.query('INSERT INTO users (name) VALUES ($1)', [user.name]);
user.id = (await pool.lastQuery()).rowCount;
}

async function getUsers(): Promise<User[]> {
const result = await pool.query('SELECT * FROM users');
return result.rows.map((row) => ({ id: row.id, name: row.name }));
}

(async () => {
await createTable();
const user1: User = { id: undefined, name: 'John Doe' };
insertUser(user1);
console.log(user1); // Logs the inserted user object without id (as it was autoincremented)
const users = await getUsers();
console.log(users); // Logs an array of users that includes John Doe
})();
