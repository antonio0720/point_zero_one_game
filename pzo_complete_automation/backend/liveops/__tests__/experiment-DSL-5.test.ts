import { Experiment } from '@backstage/live-ops-plugin-common';
import { ExperimentDsl5 } from '../../ExperimentDsl5';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'ethers';
import { expect } from 'chai';

describe('Experiment DSL 5', () => {
let experiment: Experiment;
let dsl: ExperimentDsl5;

beforeEach(async () => {
// Set up your contract for each test here.
const { accounts, deployments } = await loadFixture();
const deployment = deployments.find((d) => d.name === 'ExperimentDsl5');
const contract = await ethers.getContractAt('ExperimentDsl5', deployment.address);
experiment = new Experiment(contract, accounts[0]);
dsl = new ExperimentDsl5();
});

it('should parse a simple experiment correctly', () => {
const experimentDefinition = `
version: '5'
id: 'simple-experiment'
target: MyContract
control: 'constant'
treatment: 'SET_FOO(1)'
rolloutPercentage: 50
durationSeconds: 3600
`;

const parsedExperiment = dsl.parse(experimentDefinition);
expect(parsedExperiment).to.deep.equal(experiment);
});

it('should handle a treatment with parameters correctly', () => {
const experimentDefinition = `
version: '5'
id: 'parametrized-experiment'
target: MyContract
control: 'constant'
treatment: 'SET_BAR(${accounts[1].address})'
rolloutPercentage: 50
durationSeconds: 3600
`;

const parsedExperiment = dsl.parse(experimentDefinition);
expect(parsedExperiment).to.deep.equal(experiment);
});

// Add more test cases as needed
});
