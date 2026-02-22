import { Document, Model } from 'mongoose';
import { Schema, model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// User Schema
const userSchema = new Schema({
id: { type: String, default: () => uuidv4() },
username: { type: String, required: true, unique: true },
passwordHash: { type: String, required: true },
score: Number,
cosmetics: [
{
itemId: String,
quantity: Number,
},
],
});

userSchema.pre('save', async function (next) {
if (!this.isModified('passwordHash')) return next();
const salt = await bcrypt.genSalt(10);
this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
next();
});

userSchema.statics.comparePassword = async function (candidatePassword: string, rawPassword: string) {
return bcrypt.compare(candidatePassword, rawPassword);
};

// Leaderboard Schema
const leaderboardSchema = new Schema({
type: String, // 'daily', 'weekly', 'monthly' etc.
users: [{ type: Types.ObjectId, ref: 'User' }],
});

// Cosmetic Item Schema
const cosmeticItemSchema = new Schema({
id: { type: String, default: () => uuidv4() },
name: { type: String, required: true },
description: String,
rarity: Number, // 1 - common, 2 - uncommon, 3 - rare, 4 - epic, 5 - legendary
cost: Number,
});

// User Model
const User = model('User', userSchema);

// Leaderboard Model
const Leaderboard = model('Leaderboard', leaderboardSchema);

// Cosmetic Item Model
const CosmeticItem = model('CosmeticItem', cosmeticItemSchema);

export { User, Leaderboard, CosmeticItem };
