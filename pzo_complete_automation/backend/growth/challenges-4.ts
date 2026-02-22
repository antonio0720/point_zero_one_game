import axios from 'axios';

interface User {
id: number;
email: string;
}

interface DailyActiveUserStats {
dailyActiveUsersCount: number;
totalRegisteredUsersCount: number;
}

class GrowthAutomationService {
private apiBaseUrl = 'https://your-api.com';

async fetchDailyActiveUserStats(): Promise<DailyActiveUserStats> {
const response = await axios.get(`${this.apiBaseUrl}/users/stats`);
return response.data;
}

async sendWelcomeEmail(user: User) {
const emailTemplate = `
Welcome to our app, ${user.email}!

We're glad you joined us and can't wait to see what you create.
`;

await axios.post(`${this.apiBaseUrl}/emails`, {
to: user.email,
subject: 'Welcome to our app',
text: emailTemplate,
});
}
}

const growthAutomationService = new GrowthAutomationService();

async function main() {
const stats = await growthAutomationService.fetchDailyActiveUserStats();

// Send a welcome email to each new user who registered today
const todayUsers = stats.dailyActiveUsersCount - stats.totalRegisteredUsersCount;
const users = await axios.get(`${growthAutomationService.apiBaseUrl}/users/registered`);

for (const user of users.data) {
if (user.createdAt.getDate() === new Date().getDate()) {
growthAutomationService.sendWelcomeEmail(user);
}
}
}

main();
