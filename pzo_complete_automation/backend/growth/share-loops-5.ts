import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.API_KEY;
const baseUrl = process.env.BASE_URL;

async function getUsers(): Promise<string[]> {
const response = await axios.get(`${baseUrl}/users`, {
headers: {
'Authorization': `Bearer ${apiKey}`,
},
});

return response.data.map((user: any) => user.id);
}

async function shareContent(userId: string, contentId: string): Promise<void> {
await axios.post(`${baseUrl}/users/${userId}/content`, {
contentId,
}, {
headers: {
'Authorization': `Bearer ${apiKey}`,
},
});
}

async function run(): Promise<void> {
const users = await getUsers();
const contentIds = ['content1', 'content2', 'content3']; // Replace with actual content IDs

for (const userId of users) {
for (const contentId of contentIds) {
await shareContent(userId, contentId);
}
}
}

run().catch((error) => console.error(`Error: ${error}`));
