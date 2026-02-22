import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { FairnessValidation } from './FairnessValidation';
import { DataGenerator } from './DataGenerator';
import { Algorithm } from './Algorithm';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('Fairness Validation', () => {
let dataGenerator: DataGenerator;
let algorithm: Algorithm;
let fairnessValidation: FairnessValidation;

beforeEach(() => {
dataGenerator = new DataGenerator();
algorithm = new Algorithm();
fairnessValidation = new FairnessValidation(algorithm);
});

it('should calculate group fairness', async () => {
const data = await dataGenerator.generateData({ groupsCount: 3, samplesCount: 1000 });
const result = await fairnessValidation.calculateGroupFairness(data);

expect(result).to.be.an('array');
expect(result.length).to.equal(3);
expect(result[0].groupId).to.be.a('number');
expect(result[0].fairnessScore).to.be.a('number');
});

it('should calculate individual fairness', async () => {
const data = await dataGenerator.generateData({ groupsCount: 2, samplesCount: 1000 });
const result = await fairnessValidation.calculateIndividualFairness(data);

expect(result).to.be.an('array');
expect(result.length).to.equal(1000);
expect(result[0]).to.have.all.keys('individualId', 'fairnessScore');
});
});
