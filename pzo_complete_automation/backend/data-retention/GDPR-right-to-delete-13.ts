import { User } from './user';
import { Connection, Model } from 'mongoose';
import { Mongoose, Schema, Document } from 'mongoose';

export interface ITimeStamped extends Document {
createdAt: Date;
updatedAt: Date;
}

export const UserSchema: Schema = new Schema<User & ITimeStamped>({
// user fields...
});

UserSchema.pre('save', function (next) {
this.updatedAt = new Date();
next();
});

UserSchema.post('findOneAndDelete', async function (doc: User & ITimeStamped) {
if (!doc) return;

const userCollection = (this as any).model('User').collection;
const deletionDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days retention period

await userCollection.updateMany(
{ _id: { $nin: [doc._id] }, deletedAt: { $exists: false } },
{ $set: { deletedAt: deletionDate } }
);
});

export const User = Model<User & ITimeStamped>('User', UserSchema);

async function connectToDatabase(uri: string): Promise<void> {
const mongoose = new Mongoose();
await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
}

export async function setupDataRetention() {
await connectToDatabase('mongodb://localhost/mydb');
User.deleteMany({ deletedAt: { $exists: false } });
}
