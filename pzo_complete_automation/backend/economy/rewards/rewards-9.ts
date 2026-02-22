import { Reward } from './reward';
import { User } from '../user/user';

interface Economy {
users: Map<string, User>;
rewards: Reward[];
}

class RewardsSystem implements Economy {
private economy: Economy;

constructor() {
this.economy = {
users: new Map(),
rewards: [],
};
}

addUser(username: string): void {
const user = new User(username);
this.economy.users.set(username, user);
}

addReward(reward: RewardsSystem['Reward']): void {
this.economy.rewards.push(reward);
}

claimReward(username: string, rewardId: number): boolean {
const user = this.getUserByUsername(username);
if (!user) return false;

const reward = this.findRewardById(rewardId);
if (!reward) return false;

if (user.balance >= reward.cost) {
user.subtractBalance(reward.cost);
reward.claim();
return true;
}

return false;
}

private getUserByUsername(username: string): User | undefined {
return this.economy.users.get(username);
}

private findRewardById(rewardId: number): Reward | undefined {
return this.economy.rewards.find((reward) => reward.id === rewardId);
}
}

interface Reward {
id: number;
cost: number;
claim(): void;
}

class Prize implements Reward {
constructor(public id: number, public cost: number) {}

claim(): void {
console.log(`Reward ${this.id} has been claimed!`);
}
}

export { RewardsSystem, Prize };
