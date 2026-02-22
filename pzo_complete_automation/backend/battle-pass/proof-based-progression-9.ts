import { Document, Model, Schema, model } from 'mongoose';

// User schema
const userSchema = new Schema({
username: String,
passwordHash: String,
achievements: [String],
quests: [{
id: String,
title: String,
description: String,
reward: { type: Schema.Types.ObjectId, ref: 'Reward' },
progress: Number,
isCompleted: Boolean,
}],
battlePass: {
tier: Number,
rewardsUnlocked: [String],
isActive: Boolean,
},
});

// Reward schema
const rewardSchema = new Schema({
name: String,
description: String,
type: String, // Can be "cosmetic", "currency" etc.
value: Number, // Value for currency rewards
});

export interface IUser extends Document {
username: string;
passwordHash: string;
achievements: string[];
quests: {
id: string;
title: string;
description: string;
reward: Schema.Types.ObjectId;
progress: number;
isCompleted: boolean;
}[];
battlePass: {
tier: number;
rewardsUnlocked: string[];
isActive: boolean;
};
}

export interface IReward extends Document {
name: string;
description: string;
type: string;
value: number;
}

export const User = model<IUser>('User', userSchema);
export const Reward = model<IReward>('Reward', rewardSchema);
