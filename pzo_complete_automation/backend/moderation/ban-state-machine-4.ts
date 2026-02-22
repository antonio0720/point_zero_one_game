enum BanState {
UNBANNED = "unbanned",
BANNED = "banned",
MUTED = "muted"
}

interface User {
id: string;
state: BanState;
banEndTime?: Date; // Optional property for storing the ban end time if the user is banned or muted
}

class BanManager {
private users: Map<string, User> = new Map();

public ban(userId: string, reason: string, state: BanState, duration?: number) {
const currentUser = this.getUser(userId);

if (!currentUser) {
this.users.set(userId, { id: userId, state: state });
} else {
currentUser.state = state;

if (duration && state !== BanState.MUTED) {
const banEndTime = new Date();
banEndTime.setMinutes(banEndTime.getMinutes() + duration);
currentUser.banEndTime = banEndTime;
}
}
}

public unban(userId: string) {
const user = this.getUser(userId);

if (user && user.state !== BanState.UNBANNED) {
user.state = BanState.UNBANNED;
user.banEndTime = undefined;
}
}

public mute(userId: string, duration?: number) {
this.ban(userId, "User was muted", BanState.MUTED, duration);
}

private getUser(userId: string): User | undefined {
return this.users.get(userId);
}
}
