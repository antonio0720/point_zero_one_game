import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface User {
id: string;
username: string;
}

interface Post {
id: string;
userId: string;
content: string;
}

async function shareLoops7(accessToken: string) {
const baseUrl = 'https://api.example.com';

// Fetch users to share with
const responseUsers = await axios.get(`${baseUrl}/users`, {
headers: {
Authorization: `Bearer ${accessToken}`,
},
});
const users: User[] = responseUsers.data;

// Fetch and store posts to share
const storedPosts: Post[] = [];
for (const user of users) {
const responseUserPosts = await axios.get(`${baseUrl}/posts/${user.id}`, {
headers: {
Authorization: `Bearer ${accessToken}`,
},
});
storedPosts.push(...responseUserPosts.data);
}

// Share posts with users
for (let i = 0; i < users.length; ++i) {
const userA = users[i];
for (let j = i + 1; j < users.length; ++j) {
const userB = users[j];
// Find shared post between user A and user B
const sharedPost = storedPosts.find(post => post.userId === userA.id && post.id === userB.id);

if (sharedPost) {
continue; // Skip sharing if the post has already been shared
}

// Find an unshared post for user A to share with user B
const unsharedPost = storedPosts.find(post => post.userId !== userA.id && !storedPosts.some(p => p.id === post.id && p.userId === userB.id));

if (!unsharedPost) {
continue; // Skip sharing if no unshared post is found
}

const newPostId = uuidv4();
storedPosts.push({
id: newPostId,
userId: userA.id,
content: `Shared post from ${userA.username} with @${userB.username}: ${unsharedPost.content}`,
});

// Share the new post on both users' profiles
await axios.post(`${baseUrl}/posts`, {
userId: userA.id,
content: `Shared post from ${userA.username} with @${userB.username}: ${unsharedPost.content}`,
}, {
headers: {
Authorization: `Bearer ${accessToken}`,
},
});

await axios.post(`${baseUrl}/posts/${userB.id}`, {
userId: userB.id,
content: `Shared post from @${userA.username}: ${unsharedPost.content}`,
}, {
headers: {
Authorization: `Bearer ${accessToken}`,
},
});
}
}
}
