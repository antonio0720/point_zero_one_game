import { Pool } from 'pg';

const pool = new Pool({
user: 'db_user',
host: 'localhost',
database: 'mydatabase',
password: 'db_password',
port: 5432,
});

interface User {
id: number;
username: string;
created_at: Date;
}

function deleteExpiredUsers() {
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

pool.query(
'DELETE FROM users WHERE created_at < $1',
[thirtyDaysAgo],
(err, res) => {
if (err) console.error(err);
else console.log(`Deleted ${res.rowCount} expired users`);
}
);
}

// To schedule the function to run periodically, you can use a library like nodemailer-cron or node-cron
setInterval(() => {
deleteExpiredUsers();
}, 86400000); // Run every day (24 hours * 60 minutes * 60 seconds)
