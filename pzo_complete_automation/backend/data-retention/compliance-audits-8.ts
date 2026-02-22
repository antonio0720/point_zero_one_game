import { open } from 'sqlite';
import { Sqlite as Database } from 'sqlite3';
import cron from 'node-cron';

async function connectToDatabase() {
return open({
filename: './data.db',
driver: Database,
version: 3,
});
}

interface DataRecord {
id: number;
createdAt: Date;
expiresAt: Date;
}

async function createTable(db: Database) {
await db.run(`CREATE TABLE IF NOT EXISTS data (id INTEGER PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME);`);
}

async function insertData(db: Database, dataRecord: DataRecord) {
await db.run('INSERT INTO data (createdAt, expiresAt) VALUES (?, ?)', [dataRecord.createdAt, dataRecord.expiresAt]);
return db.lastID;
}

async function getData(db: Database): Promise<DataRecord[]> {
const rows = await db.all('SELECT * FROM data');
return rows.map((row) => ({ id: row.id, createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at) }));
}

async function deleteExpiredData(db: Database) {
const data = await getData(db);
for (const item of data) {
if (item.expiresAt <= new Date()) {
await db.run('DELETE FROM data WHERE id = ?', [item.id]);
}
}
}

async function setup() {
const db = await connectToDatabase();
await createTable(db);
}

cron.schedule('* * * * *', async () => {
console.log('Checking for expired data');
await deleteExpiredData(await connectToDatabase());
});

setup().catch((err) => console.error(`Error during setup: ${err}`));
