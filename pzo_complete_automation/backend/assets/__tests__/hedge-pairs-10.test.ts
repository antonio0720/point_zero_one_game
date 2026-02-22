import { HedgePairsService } from '../services/hedge-pairs.service';
import { createTestingConnections, closeTestingConnections } from '../../utils/typeorm-testing-utils';
import { Connection } from 'typeorm';
import { HedgePair } from '../entities/hedge-pair.entity';
import { expect } from 'chai';

describe('HedgePairsService', () => {
let connections: Connection[];
let service: HedgePairsService;

before(async () => {
connections = await createTestingConnections();
service = new HedgePairsService();
});

after(() => closeTestingConnections(connections));

describe('createHedgePair', () => {
it('should create a new hedge pair', async () => {
const newHedgePair = await service.createHedgePair({
asset1: 'asset1',
asset2: 'asset2',
correlation: 0.5,
weightage: 0.5,
});

expect(newHedgePair.id).to.be.not.null;
expect(newHedgePair.asset1).to.equal('asset1');
expect(newHedgePair.asset2).to.equal('asset2');
expect(newHedgePair.correlation).to.equal(0.5);
expect(newHedgePair.weightage).to.equal(0.5);
});
});

describe('findAll', () => {
it('should return all hedge pairs', async () => {
const existingHedgePairs = [
{ id: 1, asset1: 'asset1', asset2: 'asset2', correlation: 0.5, weightage: 0.5 },
{ id: 2, asset1: 'asset3', asset2: 'asset4', correlation: 0.7, weightage: 0.6 },
];

existingHedgePairs.forEach(async hedgePair => {
await service.createHedgePair(hedgePair);
});

const allHedgePairs = await service.findAll();
expect(allHedgePairs).to.deep.equal(existingHedgePairs);
});
});
});
