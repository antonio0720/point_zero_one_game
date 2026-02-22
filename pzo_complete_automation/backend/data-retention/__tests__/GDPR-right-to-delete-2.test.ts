import request from 'supertest';
import app from '../../../src/app';
import { cleanDb, generateUser, User } from '../../support/factories';
import { expect } from 'chai';
import mongoose from 'mongoose';
import { AfterAll, BeforeAll, Describe, It } from '@jest/spec';

let user: User;
let token: string;
let server: any;

BeforeAll(async () => {
server = await app.listen(3000);
await mongoose.connect('mongodb://localhost:27017/test-db');
user = await generateUser();
const response = await request(server)
.post('/api/auth')
.send({ email: user.email, password: 'password' });
token = response.body.token;
})

AfterAll(async () => {
await cleanDb();
await server.close();
await mongoose.disconnect();
});

Describe('GDPR Right to Delete - User Deletion', () => {
It('should delete a user and related data', async () => {
const response = await request(server)
.delete('/api/users')
.set('Authorization', `Bearer ${token}`);

expect(response.status).to.equal(204);

const deletedUserResponse = await request(server)
.get(`/api/users/${user._id}`)
.set('Authorization', `Bearer ${token}`);

expect(deletedUserResponse.status).to.equal(404);
});
});
