import { v4 as uuidv4 } from 'uuid';

interface UserData {
id: string;
name: string;
email: string;
createdAt: Date;
}

const DATA_FILE = './user-data.json';

function readUsers(): UserData[] {
try {
const rawData = fs.readFileSync(DATA_FILE, 'utf8');
return JSON.parse(rawData) as UserData[];
} catch (err) {
console.error(err);
return [];
}
}

function writeUsers(users: UserData[]): void {
const data = JSON.stringify(users, null, 2);
fs.writeFileSync(DATA_FILE, data);
}

function createUser(name: string, email: string): UserData {
const user: UserData = { id: uuidv4(), name, email, createdAt: new Date() };
const users = readUsers();
users.push(user);
writeUsers(users);
return user;
}

function deleteUserById(id: string): void {
const users = readUsers().filter((user) => user.id !== id);
writeUsers(users);
}

// Example usage
const newUser = createUser('John Doe', 'john.doe@example.com');
console.log(`New user created: ${JSON.stringify(newUser)}`);

deleteUserById(newUser.id);
console.log(`User deleted by ID: ${newUser.id}`);
