enum BanState {
NONE = 'none',
WARN = 'warn',
MUTE = 'mute',
BAN = 'ban'
}

interface BanData {
userId: string;
reason?: string;
expiresAt?: Date;
state: BanState;
}

class Ban {
private data: BanData;

constructor(userId: string, reason?: string) {
this.data = {
userId,
reason,
state: BanState.NONE,
};
}

public abuse(): void {
if (this.data.state !== BanState.NONE) throw new Error("User is already banned");
this.data.state = BanState.WARN;
console.log(`Warned user ${this.data.userId} for abuse`);
}

public mute(): void {
if (this.data.state !== BanState.WARN) throw new Error("User must be warned first");
this.data.state = BanState.MUTE;
console.log(`Muted user ${this.data.userId} for continued abuse`);
}

public ban(expiresAt?: Date): void {
if (this.data.state !== BanState.MUTE) throw new Error("User must be muted first");
this.data.state = BanState.BAN;
this.data.expiresAt = expiresAt || new Date();
console.log(`Banned user ${this.data.userId} permanently`);
}

public unban(): void {
if (this.data.state !== BanState.BAN) throw new Error("User is not banned");
this.data.state = BanState.NONE;
console.log(`Unbanned user ${this.data.userId}`);
}

public getState(): BanState {
return this.data.state;
}
}
