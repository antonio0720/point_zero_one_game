import { FraudDetection14 } from '../ml/safety/fraud-detection-14';
import { DataLoader } from '@google-cloud/bigquery';
import { BigQuery, Storage } from '@google-cloud/storage';
import { assert } from 'chai';
import 'mocha';

describe('Fraud Detection 14', () => {
let fraudDetection: FraudDetection14;
let dataLoader: DataLoader;
let bigquery: BigQuery;
let storage: Storage;

before(async () => {
fraudDetection = new FraudDetection14();
dataLoader = new DataLoader({
projectId: 'your-project-id',
sourceFile: 'gs://your-bucket/fraud_data.csv',
columnNames: true,
});
bigquery = new BigQuery();
storage = new Storage();
});

it('should correctly load data from BigQuery', async () => {
const [rows] = await dataLoader.loadData();
assert.isAbove(rows.length, 0);
});

it('should predict fraud for a sample with high risk features', async () => {
// Provide the sample data that is expected to be classified as fraudulent
const prediction = await fraudDetection.predictFraud(sampleData);
assert.isTrue(prediction.fraudulent);
});

it('should not predict fraud for a sample with low risk features', async () => {
// Provide the sample data that is expected to be classified as non-fraudulent
const prediction = await fraudDetection.predictFraud(sampleDataLowRisk);
assert.isFalse(prediction.fraudulent);
});
});
