import { PlayStyleClustering } from '../../src/backend/ml/behavioral/playstyle-clustering';
import { KMeans } from 'cluster';
import { DataPoint } from '../../src/backend/ml/data-structures';
import { expect } from 'chai';
import 'mocha';

describe('PlayStyleClustering', () => {
let playstyleClustering: PlayStyleClustering;

beforeEach(() => {
playstyleClustering = new PlayStyleClustering();
});

it('should correctly cluster playstyles with 2 clusters', () => {
const dataPoints: DataPoint[] = [
{ value1: 0.3, value2: 0.6 },
{ value1: 0.7, value2: 0.4 },
{ value1: 0.5, value2: 0.7 },
{ value1: 0.8, value2: 0.2 },
{ value1: 0.6, value2: 0.3 }
];

const kmeans = new KMeans({ k: 2 });
kmeans.fit(dataPoints.map((dp) => [dp.value1, dp.value2]));

playstyleClustering.fit(kmeans);

const clusters = playstyleClustering.predict(dataPoints.map((dp) => dp));

expect(clusters).to.deep.equal([0, 1, 0, 1, 0]);
});

it('should correctly cluster playstyles with 3 clusters', () => {
const dataPoints: DataPoint[] = [
{ value1: 0.4, value2: 0.6 },
{ value1: 0.7, value2: 0.5 },
{ value1: 0.8, value2: 0.3 },
{ value1: 0.5, value2: 0.4 },
{ value1: 0.6, value2: 0.7 }
];

const kmeans = new KMeans({ k: 3 });
kmeans.fit(dataPoints.map((dp) => [dp.value1, dp.value2]));

playstyleClustering.fit(kmeans);

const clusters = playstyleClustering.predict(dataPoints.map((dp) => dp));

expect(clusters).to.deep.equal([0, 1, 2, 0, 0]);
});
});
