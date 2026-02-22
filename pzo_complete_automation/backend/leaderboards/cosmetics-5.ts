import { Document, model, Schema } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const userSchema: Schema = new Schema({
username: { type: String, required: true, unique: true },
password: { type: String, required: true },
points: { type: Number, default: 0 },
cosmetics: [{ type: Schema.Types.ObjectId, ref: 'Cosmetic' }],
friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
});

userSchema.pre('save', async function (next) {
if (!this.isModified('password')) return next();
const salt = await bcrypt.genSalt(10);
this.password = await bcrypt.hash(this.password, salt);
next();
});

userSchema.methods.comparePassword = function (candidatePassword: string) {
return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateJWT = function () {
return jwt.sign({ userId: this._id }, process.env.SECRET_KEY!, { expiresIn: '1h' });
};

const User = model('User', userSchema);

interface ICosmetic extends Document {
name: string;
cost: number;
}

const cosmeticSchema: Schema = new Schema({
name: { type: String, required: true, unique: true },
cost: { type: Number, required: true },
});

const Cosmetic = model('Cosmetic', cosmeticSchema);

export { User, Cosmetic };
