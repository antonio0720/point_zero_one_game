interface User {
id: string;
username: string;
}

class BanManager {
private bans: Record<string, Date> = {};

public banUser(userId: string) {
this.bans[userId] = new Date();
}

public isBanned(userId: string): boolean {
return !!this.bans[userId];
}
}

class AbuseCase {
private banManager: BanManager;

constructor(banManager: BanManager) {
this.banManager = banManager;
}

public reportAbuse(user: User, reason: string) {
if (this.banManager.isBanned(user.id)) {
console.error(`User ${user.username} is already banned. Reason: ${reason}`);
return;
}

this.escalateAbuseReport(user, reason);
}

private escalateAbuseReport(user: User, reason: string) {
// Implement escalation process logic here (e.g., sending email to moderators, updating database, etc.)
console.log(`Escalating abuse report for user ${user.username}: ${reason}`);
}
}
