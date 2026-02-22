import { CounterpartyFreeze8 } from '../counterparty-freeze-8';
import { LoaderUtils } from '../../utils/loader-utils';
import { DataPoint, PredictionResponse } from '../../interfaces';
import { assert } from 'chai';
import 'mocha';

describe('Counterparty Freeze 8', () => {
let model: CounterpartyFreeze8;

beforeEach(() => {
model = new CounterpartyFreeze8(LoaderUtils.loadModel('./models/counterparty-freeze-8.json'));
});

it('should correctly predict for positive cases', () => {
const dataPoint: DataPoint = {
// Provide the required data point structure with appropriate values here
};

const predictionResponse: PredictionResponse = model.predict(dataPoint);

assert.isAtLeast(predictionResponse.probability, 0.5);
});

it('should correctly predict for negative cases', () => {
// Provide the required data point structure with appropriate values for a negative case here
const dataPoint: DataPoint = {
// Appropriate data for a negative test case
};

const predictionResponse: PredictionResponse = model.predict(dataPoint);

assert.isBelow(predictionResponse.probability, 0.5);
});
});
