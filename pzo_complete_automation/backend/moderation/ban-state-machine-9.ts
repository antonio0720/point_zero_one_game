enum BanState {
UNBANNED = 'unbanned',
MUTE = 'mute',
SOFT_BAN = 'soft_ban',
HARD_BAN = 'hard_ban'
}

interface Ban {
userId: string;
state: BanState;
expiresAt?: Date;
}

class BanManager {
private bans: Map<string, Ban> = new Map();

public ban(userId: string, state: BanState, expiresAt?: Date) {
this.bans.set(userId, { userId, state, expiresAt });
}

public unban(userId: string) {
this.bans.delete(userId);
}

public isBanned(userId: string): Ban | null {
return this.bans.get(userId);
}

public transitionState(userId: string, newState: BanState) {
const ban = this.isBanned(userId);

if (!ban) return;

if (ban.state === BanState.UNBANNED) {
throw new Error('Cannot transition from UNBANNED state');
}

this.bans.set(userId, { ...ban, state: newState });
}
}
