import { Knex } from 'knex';

const db: Knex = /* Your database instance configuration */;

// Define data retention policies (in days)
const dataRetentionPolicies = {
userData: 365, // 1 year
accountData: 730, // 2 years
};

async function checkAndDeleteExpiredData(tableName: string, columnToCheck: string): Promise<void> {
const now = new Date();
const currentTimestamp = Math.floor(now.getTime() / 1000);

// Query for data older than the retention period
const result = await db(tableName)
.where('deleted_at', null)
.where(columnToCheck, '<', currentTimestamp - dataRetentionPolicies[tableName] * 86400);

if (result.length > 0) {
// Mark the records as deleted and set a delete timestamp
await db(tableName)
.whereIn('id', result.map((row) => row.id))
.update({ deleted_at: currentTimestamp });
}
}

// Schedule data retention checks at your desired interval (e.g., daily, hourly)
setInterval(async () => {
await Promise.all([
checkAndDeleteExpiredData('users', 'created_at'),
checkAndDeleteExpiredData('accounts', 'created_at'),
]);
}, 1000 * 60 * 60 * 24); // Run every day (24 hours)
