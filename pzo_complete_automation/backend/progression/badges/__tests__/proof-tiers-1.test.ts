import { createTestingLibrary } from '@loopback/testlab';
import { expect } from 'chai';
import sinon from 'sinon';
import { ProofTiersController } from '../proof-tiers.controller';
import { ProofTiersService } from '../../services/proof-tiers.service';
import { ProofTier, User } from '../../models';
import { inject } from '@loopback/core';
import { getModelSchemaRef } from '@loopback/repository';

describe('ProofTiers Controller', () => {
const ctx = createTestingLibrary({
models: [User, ProofTier],
services: [ProofTiersService],
controllers: [ProofTiersController],
});

let app;
let proofTiersService: ProofTiersService;
let proofTiersController: ProofTiersController;

before(() => {
app = ctx.app();
sinon.stub(app, 'get').withArgs(inject(ProofTiersService)).returns(proofTiersService);
proofTiersService = new ProofTiersService({});
proofTiersController = new ProofTiersController(proofTiersService);
return app.boot();
});

after(() => app.close());

it('creates a new ProofTier', async () => {
const newProofTier = await proofTiersController.create({});
expect(newProofTier).to.be.instanceOf(ProofTier);
});

it('gets all ProofTiers', async () => {
const result = await proofTiersController.find();
expect(result).to.be.an('array');
});

it('gets a specific ProofTier by id', async () => {
const existingProofTier = await proofTiersService.create({});
const result = await proofTiersController.findById(existingProofTier.id);
expect(result).to.be.instanceOf(ProofTier);
});

it('updates a specific ProofTier', async () => {
const existingProofTier = await proofTiersService.create({});
const updatedProofTier = await proofTiersController.updateById(existingProofTier.id, {});
expect(updatedProofTier).to.be.instanceOf(ProofTier);
});

it('deletes a specific ProofTier', async () => {
const existingProofTier = await proofTiersService.create({});
await proofTiersController.deleteById(existingProofTier.id);
const result = await proofTiersController.findById(existingProofTier.id);
expect(result).to.be.null;
});

it('tests association between User and ProofTier', async () => {
const user = await ctx.datasources.ds.getRepository(User.name).create({});
const proofTier = await ctx.datasources.ds.getRepository(ProofTier.name).create({});
await ctx.datasources.ds.getRepository(User.name).add(user);
await ctx.datasources.ds.getRepository(ProofTier.name).add(proofTier);
user.proofTiers = [proofTier];
await ctx.datasources.ds.getRepository(User.name).save(user);

const result = await proofTiersController.findByUserId(user.id);
expect(result[0].id).to.equal(proofTier.id);
});
});
