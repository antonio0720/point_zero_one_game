import * as chai from 'chai';
import * as supertest from 'supertest';
import app from './app'; // Your express application
import { delay } from './utils';

const expect = chai.expect;

const trafficProfiles: Record<number, (req: supertest.SuperTest<supertest.Test>) => Promise<void>> = {
1: async (req) => {
for (let i = 0; i < 1000; i++) await req.get('/').delay(1);
},

2: async (req) => {
for (let i = 0; i < 500; i++) await req.get('/').delay(2);
},

3: async (req) => {
for (let i = 0; i < 200; i++) await req.get('/').delay(5);
},

4: async (req) => {
for (let i = 0; i < 100; i++) await req.post('/').send({ key: 'value' }).delay(10);
},

5: async (req) => {
for (let i = 0; i < 50; i++) await req.post('/').send({ key: 'value' }).delay(20);
},

6: async (req) => {
for (let i = 0; i < 20; i++) await req.post('/').send({ key: 'value' }).delay(50);
},

7: async (req) => {
for (let i = 0; i < 10; i++) await req.post('/').send({ key: 'value' }).delay(100);
},

8: async (req) => {
for (let i = 0; i < 5; i++) await req.post('/').send({ key: 'value' }).delay(200);
},

9: async (req) => {
for (let i = 0; i < 2; i++) await req.post('/').send({ key: 'value' }).delay(500);
},

10: async (req) => {
for (let i = 0; i < 1; i++) await req.post('/').send({ key: 'value' }).delay(1000);
},

11: async (req) => {
for (let i = 0; i < 10; i++) await req.get('/').delay(1);
for (let i = 0; i < 50; i++) await req.post('/').send({ key: 'value' }).delay(2);
for (let i = 0; i < 200; i++) await req.get('/').delay(5);
},

12: async (req) => {
for (let i = 0; i < 5; i++) await req.get('/').delay(1);
for (let i = 0; i < 20; i++) await req.post('/').send({ key: 'value' }).delay(2);
for (let i = 0; i < 100; i++) await req.get('/').delay(5);
},

13: async (req) => {
for (let i = 0; i < 2; i++) await req.get('/').delay(1);
for (let i = 0; i < 50; i++) await req.post('/').send({ key: 'value' }).delay(2);
for (let i = 0; i < 200; i++) await req.get('/').delay(5);
for (let i = 0; i < 10; i++) await req.post('/').send({ key: 'value' }).delay(2);
},

14: async (req) => {
for (let i = 0; i < 5; i++) await req.get('/').delay(1);
for (let i = 0; i < 2; i++) await req.post('/').send({ key: 'value' }).delay(2);
for (let i = 0; i < 100; i++) await req.get('/').delay(5);
for (let i = 0; i < 20; i++) await req.post('/').send({ key: 'value' }).delay(2);
for (let i = 0; i < 10; i++) await req.get('/').delay(5);
},
};

describe('Load testing', () => {
trafficProfiles[14](supertest(app)).then(() => console.log('Test completed.'));
});

interface IDelayablePromise<T> {
delay(ms: number): Promise<T>;
}

function delay<T>(ms: number, promise: Promise<T>): Promise<T & IDelayablePromise<T>> {
return new Promise((resolve) => setTimeout(() => resolve(promise), ms));
}
