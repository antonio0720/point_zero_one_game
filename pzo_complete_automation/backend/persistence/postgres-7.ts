import { Pool } from 'pg';

const pool = new Pool({
user: '<your_username>',
host: '<your_host>',
database: '<your_database>',
password: '<your_password>',
port: <your_port>,
});

interface User {
id?: number;
firstName: string;
lastName: string;
email: string;
}

async function createUser(user: User): Promise<User> {
const query = `
INSERT INTO users (first_name, last_name, email)
VALUES ($1, $2, $3)
RETURNING id`;

const result = await pool.query(query, [user.firstName, user.lastName, user.email]);
const userId = result.rows[0].id;

user.id = userId;
return user;
}
