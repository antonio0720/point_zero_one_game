import axios from 'axios';
import { Check, sleep } from 'k6';
import Faker from '@faker-js/faker';

const API_URL = 'http://your-api-url.com';
const USERS_COUNT = 1000;

export let options = {
vus: 5,
duration: '3m',
};

function generateRandomUser() {
return {
name: Faker.name.firstName(),
lastName: Faker.name.lastName(),
email: Faker.internet.email(),
};
}

let users = [];
for (let i = 0; i < USERS_COUNT; i++) {
users.push(generateRandomUser());
}

function createUser(userId) {
return axios.post(`${API_URL}/users/${userId}`, users[userId]);
}

export default function () {
for (let userId of new Array(USERS_COUNT).fill(null).map((_, i) => i)) {
createUser(userId).catch(() => Check.fail('Failed to create user'));
}

sleep(1); // Ensure all requests are sent before checking the results
}
