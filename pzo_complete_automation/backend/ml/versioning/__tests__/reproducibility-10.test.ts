import { DatasetVersion, DatasetLineage } from '../../dataset';
import { DataLoader } from '../../data-loader';
import { assert } from 'chai';
import sinon from 'sinon';
import { version10Data } from './fixtures/version10-data';

describe('Dataset Versioning + Lineage - Reproducibility Test (Version 10)', () => {
let dataLoader: DataLoader;

beforeEach(() => {
dataLoader = new DataLoader();
});

it('should generate the same dataset version given the same input', () => {
const originalData = version10Data();
const version1 = dataLoader.createDatasetVersion(originalData);
const version2 = dataLoader.createDatasetVersion(originalData);

assert.deepEqual(version1, version2);
});

it('should generate different dataset versions when the input is changed', () => {
const originalData = version10Data();
const modifiedData = [...originalData, { id: 'modified' }];
const version1 = dataLoader.createDatasetVersion(originalData);
const version2 = dataLoader.createDatasetVersion(modifiedData);

assert.notDeepEqual(version1, version2);
});

it('should create a new lineage node when a new dataset version is created', () => {
const originalData = version10Data();
const spy = sinon.spy(dataLoader, 'createDatasetLineage');

dataLoader.createDatasetVersion(originalData);

assert.calledOnce(spy);
});

it('should link the new dataset version to its parent lineage node', () => {
const originalData = version10Data();
const spy = sinon.spy(dataLoader, 'linkDatasetVersionToLineage');

dataLoader.createDatasetVersion(originalData);

assert.calledOnce(spy);
});
});
