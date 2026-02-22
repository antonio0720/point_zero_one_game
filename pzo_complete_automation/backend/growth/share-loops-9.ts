import axios from 'axios';

interface User {
id: number;
username: string;
}

interface Post {
id: number;
userId: number;
content: string;
}

const baseUrl = 'https://api.example.com/v1';

async function getUsers(): Promise<User[]> {
const response = await axios.get(`${baseUrl}/users`);
return response.data;
}

async function getPosts(userId: number): Promise<Post[]> {
const response = await axios.get(`${baseUrl}/posts?user_id=${userId}`);
return response.data;
}

async function sharePostsWithUsers(users: User[], postId: number) {
for (const user of users) {
const posts = await getPosts(user.id);
const userPost = posts.find((p) => p.id === postId);

if (!userPost) {
console.log(`No post with id ${postId} found for user ${user.username}`);
continue;
}

axios.post(`${baseUrl}/shares`, { userId: user.id, postId });
}
}

(async () => {
try {
const users = await getUsers();
const firstPost = await getPosts(users[0].id).then((posts) => posts[0]);

if (!firstPost) {
console.error('No initial post found for any user');
return;
}

sharePostsWithUsers(users, firstPost.id);
} catch (err) {
console.error(`Error: ${err}`);
}
})();
