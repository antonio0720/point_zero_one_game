enum BanState {
INITIAL = 'initial',
PENDING = 'pending',
ACTIVE = 'active',
EXPIRED = 'expired'
}

interface UserBan {
userId: string;
reason: string;
state: BanState;
expiresAt?: Date; // optional expiration timestamp
}

class BanManager {
private bans: Map<string, UserBan> = new Map();

banUser(userId: string, reason: string, expiresAt?: Date): void {
const userBan: UserBan = { userId, reason, state: BanState.PENDING, expiresAt };
this.bans.set(userId, userBan);

this.transitionToPending(userBan);
}

unbanUser(userId: string): void {
const userBan = this.bans.get(userId);
if (!userBan) return;

userBan.state = BanState.EXPIRED;
this.transitionToExpired(userBan);
}

private transitionToPending(userBan: UserBan): void {
userBan.state = BanState.PENDING;
console.log(`User ${userBan.userId} is now banned (pending).`);
}

private transitionToActive(userBan: UserBan): void {
userBan.state = BanState.ACTIVE;
console.log(`User ${userBan.userId} is now banned (active).`);
}

private transitionToExpired(userBan: UserBan): void {
userBan.state = BanState.EXPIRED;
this.bans.delete(userBan.userId);
console.log(`User ${userBan.userId} is no longer banned.`);
}
}
