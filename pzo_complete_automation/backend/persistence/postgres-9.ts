import { Pool } from 'pg';

const pool = new Pool({
user: 'your_db_user',
host: 'localhost',
database: 'your_database_name',
password: 'your_password',
port: 5432,
});

class UserRepository {
private pool;

constructor() {
this.pool = pool;
}

async createUser(user: any): Promise<void> {
const query = `INSERT INTO users (username, email) VALUES ($1, $2)`;
await this.pool.query(query, [user.username, user.email]);
}

async findUserByUsername(username: string): Promise<any> {
const query = `SELECT * FROM users WHERE username = $1`;
const result = await this.pool.query(query, [username]);
return result.rows[0];
}
}

export default new UserRepository();
