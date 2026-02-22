import { v4 as uuidv4 } from 'uuid';

enum ReferralStatus {
PENDING = 'pending',
ACCEPTED = 'accepted',
REJECTED = 'rejected',
}

class User {
id: string;
referralCode?: string;
status?: ReferralStatus;

constructor(id: string) {
this.id = id;
this.referralCode = uuidv4();
this.status = ReferralStatus.PENDING;
}

// Update referral status based on certain conditions (not shown here)
}

class ReferralSystem {
users: Map<string, User>;

constructor() {
this.users = new Map();
}

addUser(id: string): void {
this.users.set(id, new User(id));
}

getUserByReferralCode(referralCode: string): User | undefined {
return Array.from(this.users.values()).find((user) => user.referralCode === referralCode);
}

updateUserStatus(userId: string, status: ReferralStatus): void {
const user = this.users.get(userId);
if (user) {
user.status = status;
}
}
}
