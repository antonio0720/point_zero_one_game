import * as Joi from 'joi';

interface User {
username: string;
password: string;
}

const userSchema = Joi.object<User>({
username: Joi.string().alphanum().min(3).max(30).required(),
password: Joi.string().pattern(/^[a-zA-Z0-9]{3,72}$/).required(),
});

function validateUser(user: User) {
const result = userSchema.validate(user);
if (result.error) {
throw new Error('Invalid user data');
}
return user;
}
