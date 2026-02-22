import { User } from "./user";
import { Currency } from "./currency";
import { EventEmitter } from "events";

export class Reward {
constructor(
public id: string,
public name: string,
public description: string,
public currency: Currency,
public cost: number,
private _emitter: EventEmitter
) {}

acquireReward(user: User) {
if (user.balance >= this.cost) {
user.spendCurrency(this.currency, this.cost);
this._emitter.emit("rewardAcquired", {
rewardId: this.id,
userId: user.id,
});
} else {
this._emitter.emit("insufficientFunds");
}
}
}

export class RewardSystem extends EventEmitter {
private rewards: Map<string, Reward> = new Map();

addReward(reward: Reward) {
this.rewards.set(reward.id, reward);
}

getReward(id: string): Reward | undefined {
return this.rewards.get(id);
}
}
