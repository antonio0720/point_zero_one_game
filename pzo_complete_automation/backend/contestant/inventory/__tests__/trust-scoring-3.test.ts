import { ContestantCore } from '../../contestant-core';
import { TrustScoring3 } from './trust-scoring-3';
import { expect } from 'chai';
import 'mocha';

describe('Trust Scoring 3', () => {
let contestantCore: ContestantCore;
let trustScoring3: TrustScoring3;

beforeEach(() => {
contestantCore = new ContestantCore();
trustScoring3 = new TrustScoring3(contestantCore);
});

it('should calculate correct trust score for simple case', () => {
// Setup contestant data
const contestantData = {
id: '123',
name: 'John Doe',
age: 25,
gender: 'Male',
email: 'johndoe@example.com',
registrationDate: new Date('2022-01-01T00:00:00Z'),
totalContestsEntered: 3,
contestsWon: 2,
contestsLost: 1,
averageRank: 2.5,
totalQuestionsAnswered: 10,
correctAnswers: 8,
incorrectAnswers: 2,
skippedQuestions: 0,
};

// Call trust scoring function and get result
const trustScore = trustScoring3.calculateTrustScore(contestantData);

expect(trustScore).to.equal(75);
});

it('should calculate correct trust score for complex case', () => {
// Setup contestant data for a more complex case
const contestantData = {
id: '456',
name: 'Jane Smith',
age: 30,
gender: 'Female',
email: 'janesmith@example.com',
registrationDate: new Date('2019-07-15T12:34:56Z'),
totalContestsEntered: 8,
contestsWon: 4,
contestsLost: 3,
averageRank: 2.8,
totalQuestionsAnswered: 20,
correctAnswers: 16,
incorrectAnswers: 4,
skippedQuestions: 0,
};

// Call trust scoring function and get result
const trustScore = trustScoring3.calculateTrustScore(contestantData);

expect(trustScore).to.equal(80);
});
});
