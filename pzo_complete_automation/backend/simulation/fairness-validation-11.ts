import { fairnessValidator } from './fairnessValidator';
import { ScoringFunction, DataSet } from './interfaces';

const data: DataSet = [
// Replace with your actual data
{ id: 'user1', score: 80 },
{ id: 'user2', score: 90 },
{ id: 'user3', score: 75 },
// ... more user data
];

const scoringFunction: ScoringFunction = (score) => score;

// Define desired fairness metrics
const minPassingScore = 80;
const maxPassingScore = 90;
const passingThreshold = 0.7; // 70% of users should have a score between minPassingScore and maxPassingScore

const { isFair, passingUsersCount, totalUsersCount } = fairnessValidator(data, scoringFunction, {
minPassingScore,
maxPassingScore,
passingThreshold,
});

console.log(`Is the simulation fair: ${isFair}`);
console.log(`Number of users passing the score criteria: ${passingUsersCount}`);
console.log(`Total number of users in the simulation: ${totalUsersCount}`);
