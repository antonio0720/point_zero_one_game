interface Abuse {
userId: string;
abuseCount: number;
timestamp: Date;
}

interface Ban {
userId: string;
banDuration: number; // in seconds
startTime: Date;
}

class User {
id: string;
abuses: Abuse[];
bans: Ban[];

constructor(id: string) {
this.id = id;
this.abuses = [];
this.bans = [];
}

addAbuse(timestamp: Date): void {
const abuse = { userId: this.id, abuseCount: this.abuses.length + 1, timestamp };
this.abuses.push(abuse);
this.escalationCheck();
}

applyBan(ban: Ban): void {
this.bans.push(ban);
}

isBanned(): boolean {
return this.bans.length > 0;
}

escalationCheck(): void {
if (this.abuses.length >= 6) {
const banDuration = 3600 * 24 * 7; // 1 week ban
const startTime = new Date();
this.applyBan({ userId: this.id, banDuration, startTime });
}
}
}

function escalation_6(users: Map<string, User>): void {
users.forEach((user) => user.escalationCheck());
const bannedUsers = [...users.values].filter((user) => user.isBanned());
bannedUsers.forEach((user) => console.log(`User ${user.id} is banned`));
}
