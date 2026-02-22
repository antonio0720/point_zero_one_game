interface User {
id: number;
username: string;
points: number;
}

interface Badge {
id: number;
name: string;
description: string;
requiredPoints: number;
}

class LeaderboardService {
private users: User[] = [];
private badges: Badge[] = [
{ id: 1, name: 'Newbie', description: 'Just started playing', requiredPoints: 0 },
{ id: 2, name: 'Rookie', description: 'Showing some progress', requiredPoints: 50 },
// Add more badges as needed
];

public addUser(username: string): void {
const newUser: User = { id: this.users.length + 1, username, points: 0 };
this.users.push(newUser);
}

public updateUserPoints(userId: number, points: number): void {
const userIndex = this.users.findIndex((user) => user.id === userId);

if (userIndex !== -1) {
this.users[userIndex].points += points;
}
}

public awardBadge(userId: number, badgeId: number): void {
const userIndex = this.users.findIndex((user) => user.id === userId);
const badgeIndex = this.badges.findIndex((badge) => badge.id === badgeId);

if (userIndex !== -1 && this.users[userIndex].points >= this.badges[badgeIndex].requiredPoints) {
console.log(`${this.users[userIndex].username} received the ${this.badges[badgeIndex].name} badge!`);
this.updateUserPoints(userId, -this.badges[badgeIndex].requiredPoints);
}
}
}
