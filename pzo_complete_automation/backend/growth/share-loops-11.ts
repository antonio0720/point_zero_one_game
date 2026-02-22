import axios from 'axios';

interface User {
id: number;
email: string;
}

interface Post {
userId: number;
content: string;
createdAt: Date;
}

const shareLoops11 = async (users: User[], postContent: string) => {
const posts: Post[] = [];

for (const user of users) {
try {
const response = await axios.post(`https://api.example.com/posts`, {
userId: user.id,
content: postContent,
createdAt: new Date(),
});

if (response.status === 201) {
posts.push({
userId: user.id,
content: postContent,
createdAt: response.data.createdAt,
});
}
} catch (error) {
console.error(`Failed to share post with user ${user.email}:`, error);
}
}

return posts;
};

export default shareLoops11;
