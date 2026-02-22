import axios from 'axios';

interface Loop {
id: string;
title: string;
description: string;
url: string;
}

interface User {
id: string;
username: string;
email: string;
}

const LOOPS_API = 'https://api.example.com/loops';
const USERS_API = 'https://api.example.com/users';

async function getLoops(): Promise<Loop[]> {
const response = await axios.get(LOOPS_API);
return response.data;
}

async function getUsers(): Promise<User[]> {
const response = await axios.get(USERS_API);
return response.data;
}

async function shareLoopWithUsers(loop: Loop, users: User[]) {
for (const user of users) {
await axios.post(`${LOOPS_API}/share/${user.id}`, loop);
}
}

async function main() {
try {
const loops = await getLoops();
const users = await getUsers();

shareLoopWithUsers(loops[0], users); // Share the first loop with all users
} catch (error) {
console.error('Error:', error);
}
}

main();
