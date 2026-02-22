import { v4 as uuidv4 } from 'uuid';

interface UserData {
id: string;
createdAt: Date;
updatedAt: Date;
deletedAt?: Date;
name: string;
email: string;
}

const users: UserData[] = [];

function createUser(name: string, email: string): UserData {
const user: UserData = {
id: uuidv4(),
createdAt: new Date(),
updatedAt: new Date(),
name,
email,
};

users.push(user);
return user;
}

function deleteUserById(id: string): void {
const index = users.findIndex((user) => user.id === id);

if (index !== -1) {
users[index].deletedAt = new Date();
}
}

function findUserById(id: string): UserData | undefined {
return users.find((user) => user.id === id && !user.deletedAt);
}

function findAllUsers(): UserData[] {
return users.filter((user) => !user.deletedAt);
}
