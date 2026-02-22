import { beforeEach, describe, expect, it } from '@jest';
import { DriftDetectionAlgorithm2 } from '../drift-detection-algorithm-2';
import { Generator } from 'random-data-generator';
import { GaussianMixtureModel } from '../../clustering/gaussian-mixture-model';
import { NormalizedData } from '../../data-normalization/normalized-data';

let driftDetection: DriftDetectionAlgorithm2;
const dataGenerator = new Generator();

beforeEach(() => {
const numSamples = 1000;
const numClusters = 3;
const data = Array.from({ length: numSamples }, () => [
dataGenerator.gaussian().x,
dataGenerator.gaussian().y
]);

const means = [];
const covariances = [];

for (let i = 0; i < numClusters; i++) {
means.push([dataGenerator.normal().mean(), dataGenerator.normal().mean()]);
covariances.push({ a: dataGenerator.normal().variance(), b: dataGenerator.normal().variance() });
}

const gmm = new GaussianMixtureModel(numClusters, means, covariances);
const normalizedData = new NormalizedData(gmm, data);

driftDetection = new DriftDetectionAlgorithm2(normalizedData, 0.1, 5);
});

describe('Drift Detection Algorithm 2', () => {
it('should correctly detect drift when data shifts', () => {
// ...
});

it('should not trigger false alarms when data does not shift', () => {
// ...
});
});
