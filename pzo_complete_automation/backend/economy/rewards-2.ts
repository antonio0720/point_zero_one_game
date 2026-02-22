interface User {
id: number;
balance: number;
}

interface Reward {
id: number;
name: string;
pointsRequired: number;
rewardAmount: number;
}

class Economy {
private users: User[];
private rewards: Reward[];

constructor() {
this.users = [];
this.rewards = [];
}

addUser(user: User) {
this.users.push(user);
}

addReward(reward: Reward) {
this.rewards.push(reward);
}

claimReward(userId: number, rewardId: number) {
const user = this.users.find((u) => u.id === userId);
if (!user) return null;

const reward = this.rewards.find((r) => r.id === rewardId);
if (!reward) return null;

if (user.balance >= reward.pointsRequired) {
user.balance -= reward.pointsRequired;
user.balance += reward.rewardAmount;

return { success: true, newBalance: user.balance };
} else {
return { success: false, message: 'Insufficient points' };
}
}
}
