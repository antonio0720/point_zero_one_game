import mongoose, { Document, Model } from 'mongoose';

interface IUser extends Document {
username: string;
createdAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
username: { type: String, required: true },
createdAt: { type: Date, default: Date.now },
});

export const User: Model<IUser> = mongoose.model('User', UserSchema);

const dataRetentionHours = 72; // Retain user data for 3 days (72 hours)

async function cleanupUsers() {
const currentTimeStamp = new Date();
const cutoffTimeStamp = new Date(currentTimeStamp.getTime() - dataRetentionHours * 60 * 60 * 1000);

await User.remove({ createdAt: { $lt: cutoffTimeStamp } });
}

cleanupUsers(); // Run immediately on app start
setInterval(cleanupUsers, dataRetentionHours * 60 * 60 * 1000); // Run every 72 hours
