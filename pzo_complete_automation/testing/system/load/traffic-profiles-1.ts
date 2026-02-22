import * as chai from 'chai';
import * as chaiHttp from 'chai-http';
import express from 'express';
import bodyParser from 'body-parser';
import { describe, it } from 'mocha';

chai.use(chaiHttp);
const expect = chai.expect;
const app = express();
app.use(bodyParser.json());

// Define your traffic profiles here
const lowProfile = () => {
return [1, 2, 3, 4, 5].map(() => chaiHttp.request(app).get('/'));
};

const mediumProfile = () => {
return [...lowProfile(), ...Array(10).fill(chaiHttp.request(app)).map((req) => [req.get, req.post].flat())];
};

const highProfile = () => {
return [...mediumProfile(), ...Array(50).fill(chaiHttp.request(app)).map((req) => Array(3).fill(req.get).concat(Array(2).fill(req.post))));
};

describe('Load Testing', () => {
before(() => app.listen(3000));

it('Low Traffic Profile', async function() {
const requests = lowProfile();
await Promise.all(requests);
for (let i = 0; i < requests.length; i++) {
expect(requests[i].res).to.have.status(200);
}
});

it('Medium Traffic Profile', async function() {
const requests = mediumProfile();
await Promise.all(requests);
for (let i = 0; i < requests.length; i++) {
expect(requests[i].res).to.have.status(200);
}
});

it('High Traffic Profile', async function() {
const requests = highProfile();
await Promise.all(requests);
for (let i = 0; i < requests.length; i++) {
expect(requests[i].res).to.have.status(200);
}
});

after(() => app.close());
});
