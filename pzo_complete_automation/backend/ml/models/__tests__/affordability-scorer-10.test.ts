import { AffordabilityScorer10 } from '../../models/affordability-scorer-10';
import { IAffordabilityScorerData } from '../../interfaces/IAffordabilityScorerData';
import { expect } from 'chai';
import sinon from 'sinon';
import faker from 'faker';

describe('ML Core Models - AffordabilityScorer-10', () => {
let affordabilityScorer10: AffordabilityScorer10;

beforeEach(() => {
affordabilityScorer10 = new AffordabilityScorer10();
});

it('should return the correct affordability score for given data', () => {
const mockData: IAffordabilityScorerData = {
income: faker.random.number({ min: 50000, max: 200000 }),
debt_to_income_ratio: faker.random.float({ min: 0.1, max: 0.4 }),
credit_score: faker.random.number({ min: 600, max: 850 }),
loan_amount: faker.random.number({ min: 10000, max: 300000 }),
loan_term: faker.random.number({ min: 24, max: 60 }),
};

const mockAffordabilityScore = affordabilityScorer10.score(mockData);

expect(mockAffordabilityScore).to.be.within(0, 100);
});

it('should return an error message when the input data is invalid', () => {
const mockInvalidData = {
income: faker.random.number({ min: -1, max: 0 }),
debt_to_income_ratio: faker.random.float({ min: -1, max: 2 }),
credit_score: faker.random.number({ min: -1, max: 1000 }),
loan_amount: faker.random.number({ min: -1, max: 0 }),
loan_term: faker.random.number({ min: -1, max: 0 }),
};

const mockError = affordabilityScorer10.score(mockInvalidData);

expect(mockError).to.equal('Error: Invalid input data.');
});

it('should return an error message when the input data is missing required fields', () => {
const mockMissingData = {
income: faker.random.number({ min: 1, max: 200000 }),
debt_to_income_ratio: faker.random.float({ min: 0.1, max: 0.4 }),
loan_amount: faker.random.number({ min: 10000, max: 300000 }),
loan_term: faker.random.number({ min: 24, max: 60 }),
};

const mockError = affordabilityScorer10.score(mockMissingData);

expect(mockError).to.equal('Error: Missing required fields.');
});
});
