import axios from 'axios';

interface User {
id: number;
email: string;
}

async function shareLoops6(users: User[]) {
for (const user of users) {
try {
await axios.post('https://your-api.com/send-email', {
recipient: user.email,
message: 'Join us now! Use this referral link to get a special offer: https://referral-link.com'
});
} catch (error) {
console.error(`Error sending email to ${user.email}:`, error);
}
}
}
