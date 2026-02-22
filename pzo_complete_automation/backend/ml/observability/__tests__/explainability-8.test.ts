import { expect } from 'chai';
import { ExplainabilityModel } from '../../explainability-model';
import { CLModel } from '../../../ml/continuous-learning/cl-model';
import { DataLoader } from '../../data-loader';
import { Metrics } from '../../metrics';
import { createTestData } from '../test-utilities';

describe('Explainability Model - Continuous Learning - Test 8', () => {
let explainModel: ExplainabilityModel;
let clModel: CLModel;
let dataLoader: DataLoader;
let metrics: Metrics;

beforeEach(async () => {
dataLoader = new DataLoader();
metrics = new Metrics();
const testData = await createTestData(8);
explainModel = new ExplainabilityModel({});
clModel = new CLModel({ model: explainModel });
await clModel.fit(testData.trainData, testData.trainLabels);
});

it('Should calculate explanations for a new example', async () => {
const newExample = testData.newExample;
const explanation = await explainModel.explain(clModel, newExample);
expect(explanation).to.be.an('array');
});

it('Should update the model with a new example', async () => {
const newExample = testData.newExample;
const preUpdateAccuracy = clModel.getMetrics().accuracy;
await clModel.update(newExample, testData.newLabel);
const postUpdateAccuracy = clModel.getMetrics().accuracy;
expect(postUpdateAccuracy).to.be.greaterThan(preUpdateAccuracy);
});
});
