import { Model, Document } from 'mongoose';

interface UserDocument extends Document {
email: string;
}

const UserSchema = new Model<UserDocument>('User', new Schema({
email: { type: String, required: true, unique: true },
}));

async function deleteUserByEmail(email: string) {
await UserSchema.findOneAndDelete({ email }).exec();
}

export default deleteUserByEmail;
