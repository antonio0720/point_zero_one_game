import { v4 as uuidv4 } from 'uuid';

interface User {
id: string;
username: string;
email: string;
}

interface Ban {
userId: string;
reason: string;
banDuration: number; // in days
createdAt: Date;
}

interface Appeal {
appealId: string;
userId: string;
banId: string | null;
reason: string;
status: 'pending' | 'approved' | 'rejected';
decisionMaker: string | null; // user id of the moderator who made the decision
createdAt: Date;
}

class BanManager {
private bans: Ban[] = [];

public createBan(userId: string, reason: string, banDuration: number): string {
const banId = uuidv4();
this.bans.push({ userId, reason, banDuration, createdAt: new Date() });
return banId;
}

public getBan(banId: string): Ban | null {
return this.bans.find((ban) => ban.id === banId);
}
}

class AppealManager {
private appeals: Appeal[] = [];
private moderators: User[];
private banManager: BanManager;

constructor(moderators: User[], banManager: BanManager) {
this.moderators = moderators;
this.banManager = banManager;
}

public createAppeal(userId: string, reason: string): Appeal {
const appealId = uuidv4();
const appeal = {
appealId,
userId,
banId: null,
reason,
status: 'pending',
decisionMaker: null,
createdAt: new Date(),
};
this.appeals.push(appeal);
return appeal;
}

public getAppeal(appealId: string): Appeal | null {
return this.appeals.find((appeal) => appeal.appealId === appealId);
}

public handleAppeal(appeal: Appeal, moderatorId: string): void {
if (!this.moderators.some((m) => m.id === moderatorId)) {
throw new Error('Moderator not found');
}

const ban = this.banManager.getBan(appeal.banId);

if (!ban || appeal.status !== 'pending') {
throw new Error('Invalid appeal state or ban not found');
}

const decisionMaker = moderatorId;
const decision = appeal.reason.toLowerCase().includes('unjustified');

appeal.status = decision ? 'approved' : 'rejected';
appeal.decisionMaker = decisionMaker;

if (decision) {
this.banManager.removeBan(appeal.banId);
}
}

public removeBan(banId: string): void {
const banIndex = this.bans.findIndex((ban) => ban.id === banId);

if (banIndex !== -1) {
this.bans.splice(banIndex, 1);
}
}
}
