interface Ban {
userId: string;
reason: string;
expiresAt: Date | null;
}

class ModerationQueue {
private bans: Ban[] = [];

addBan(userId: string, reason: string, expiresAt?: Date): void {
this.bans.push({ userId, reason, expiresAt });
}

removeBan(userId: string): void {
this.bans = this.bans.filter((ban) => ban.userId !== userId);
}

hasBan(userId: string): boolean {
return this.bans.some((ban) => ban.userId === userId);
}

getBans(): Ban[] {
return [...this.bans];
}
}
