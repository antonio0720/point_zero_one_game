import axios from 'axios';
import faker from 'faker';
import _ from 'lodash';
import sinon from 'sinon';

const API_URL = 'http://your-api-url.com';
const USERS_COUNT = 100;

async function generateUsers(): Promise<Array<any>> {
const users: Array<any> = [];
for (let i = 0; i < USERS_COUNT; i++) {
users.push({
id: faker.datatype.uuid(),
name: faker.name.findName(),
email: faker.internet.email(faker.name.findName()),
});
}
return users;
}

async function createUsers(users: Array<any>) {
const requests = users.map((user) => axios.post(`${API_URL}/api/users`, user));
const responses = await Promise.all(requests);
return responses.map((response) => response.data);
}

function randomDelay(min: number, max: number): number {
return Math.random() * (max - min) + min;
}

async function createUserWithRandomDelay(user: any) {
await new Promise((resolve) => setTimeout(resolve, randomDelay(50, 300)));
const createdUser = await axios.post(`${API_URL}/api/users`, user);
return createdUser.data;
}

function mockUpdateUser() {
const updateUserStub = sinon.stub(axios, 'put');
updateUserStub.resolves({ data: {} });
return () => updateUserStub.restore();
}

async function loadTest(users: Array<any>) {
const promises = users.map((user) => createUserWithRandomDelay(user));
await Promise.all(promises);
}

async function stressTest(users: Array<any>, iterations: number) {
for (let i = 0; i < iterations; i++) {
await loadTest(users);
}
}

function chaosTest(users: Array<any>) {
const updateUserMock = mockUpdateUser();

async function createWithError(user: any) {
try {
return createUserWithRandomDelay(user);
} catch (error) {
console.log('Simulated error during user creation', error);
return null;
}
}

async function updateWithError(id: string) {
try {
await axios.put(`${API_URL}/api/users/${id}`, {});
} catch (error) {
console.log('Simulated error during user update', error);
}
}

async function chaosIteration() {
const users = await generateUsers();
const createPromises = users.map((user) => createWithError(user));
await Promise.all(createPromises);

// Simulate random user updates with errors
const updatedUserIds = _.sampleSize(users, Math.floor(USERS_COUNT * 0.3));
updatedUserIds.forEach((id) => updateWithError(id));
}

for (let i = 0; i < 10; i++) {
chaosIteration();
}

updateUserMock();
}

(async () => {
const users = await generateUsers();
await stressTest(users, 10);
await chaosTest(users);
})();
