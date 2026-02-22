import { Connection, createConnection } from 'typeorm';
import { User } from './entities/User';

const dataRetention = async (daysToKeep: number) => {
const connection = await createConnection();

try {
// Delete users older than the specified number of days
const deleteQuery = connection
.createQueryBuilder(User, 'user')
.where('user.createdAt < :cutoff', { cutoff: new Date(Date.now() - daysToKeep * 86400000) })
.setOptions({ cascade: true });
await deleteQuery.execute();
} catch (error) {
console.error('Error executing data deletion:', error);
} finally {
connection.close();
}
};

// Usage example: Keep user data for 30 days
dataRetention(30);
