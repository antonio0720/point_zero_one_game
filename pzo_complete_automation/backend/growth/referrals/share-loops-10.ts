import { User } from './user';
import { ReferralCode } from './referral-code';

export class ShareLoops10 {
private users: Map<number, User> = new Map();
private referralCodes: Map<string, ReferralCode> = new Map();

public addUser(id: number, username: string): void {
const user = new User(id, username);
this.users.set(id, user);
}

public generateReferralCode(userId: number): string {
const code = `${userId}${Math.floor(Math.random() * 1000000)}`;
if (!this.referralCodes.has(code)) {
this.referralCodes.set(code, new ReferralCode(userId));
} else {
return this.generateReferralCode(userId); // recursively generate a new code if the provided one already exists
}

return code;
}

public rewardReferral(referrerId: number, referralCode: string): void {
const referral = this.referralCodes.get(referralCode);
if (referral) {
const referrer = this.users.get(referrerId);
if (referrer) {
referrer.increaseCredits(10); // reward the referrer with 10 credits
referral.incrementReferrals(); // increment the number of referrals for the provided code
}
}
}
}
