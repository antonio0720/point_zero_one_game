import * as io from 'socket.io-client';
import * as redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SOCKET_IO_SERVER_URL = process.env.SOCKET_IO_SERVER_URL || 'http://localhost:3000';

const redisClient = new redis(REDIS_URL);
const socket = io(SOCKET_IO_SERVER_URL);

interface User {
id: string;
score: number;
weight: number;
}

function getSortedUsers(): Promise<User[]> {
return redisClient.zrevrange('users', 0, -1, 'WITHSCORES').then((values) => {
const sortedUsers = values.map((value): User => {
const [id, score, weight] = value as string[];
return { id, score: Number(score), weight: Number(weight) };
});
return sortedUsers;
});
}

function addUser(userId: string, userScore: number, userWeight: number): Promise<void> {
return redisClient.zadd('users', [userScore * userWeight, userId]).then(() => {
console.log(`Added user ${userId}`);
});
}

socket.on('newUser', ({ userId, userScore, userWeight }) => addUser(userId, userScore, userWeight));

getSortedUsers().then((sortedUsers) => {
console.log('Initial leaderboard:');
console.table(sortedUsers);
});
