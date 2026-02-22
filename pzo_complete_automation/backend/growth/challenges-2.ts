import axios from 'axios';

interface User {
id: number;
name: string;
email: string;
}

async function fetchUsers(url: string): Promise<User[]> {
const response = await axios.get(url);
return response.data as User[];
}

function filterUsersByName(users: User[], name: string): User[] {
return users.filter((user) => user.name.toLowerCase().includes(name.toLowerCase()));
}

async function getUsersByEmailDomain(emailDomain: string): Promise<User[]> {
const users = await fetchUsers('https://api.example.com/users');
return filterUsersByName(users, '@' + emailDomain);
}

(async () => {
const emailDomain = 'example.com';
const users = await getUsersByEmailDomain(emailDomain);
console.log(users);
})();
