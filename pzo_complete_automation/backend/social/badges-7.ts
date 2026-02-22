interface User {
id: number;
username: string;
points: number;
}

interface Badge {
id: number;
name: string;
points: number;
}

class Leaderboard {
private users: User[];
private badges: Badge[];

constructor() {
this.users = [];
this.badges = [
{ id: 1, name: 'Bronze', points: 10 },
{ id: 2, name: 'Silver', points: 50 },
{ id: 3, name: 'Gold', points: 100 },
];
}

addUser(username: string): void {
const user: User = { id: Date.now(), username, points: 0 };
this.users.push(user);
}

awardBadge(userId: number, badgeId: number): void {
const userIndex = this.users.findIndex((user) => user.id === userId);
if (userIndex !== -1) {
const user = this.users[userIndex];
const badge = this.badges.find((badge) => badge.id === badgeId);

if (badge && user.points >= badge.points) {
user.points -= badge.points;
console.log(`${user.username} received the ${badge.name} badge!`);
} else {
console.log('Error: Invalid badge or insufficient points.');
}
} else {
console.log('Error: User not found.');
}
}

getLeaderboard(): string {
return this.users
.sort((a, b) => b.points - a.points)
.map((user, index) => `${index + 1}. ${user.username} (${user.points})`)
.join('\n');
}
}

const leaderboard = new Leaderboard();
leaderboard.addUser('Alice');
leaderboard.awardBadge(leaderboard.users[0].id, 1);
console.log(leaderboard.getLeaderboard()); // Output: 1. Alice (90)
