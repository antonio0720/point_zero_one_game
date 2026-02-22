export interface UserType {
username: string;
email: string;
password: string;
}

const userSchema = new mongoose.Schema({
username: String,
email: String,
password: String
});

export const UserModel: UserModelType = mongoose.model<UserType>('User', userSchema);
