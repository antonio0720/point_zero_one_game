import { autoRollback5 } from '../auto-rollback-5';
import { expect } from 'expect';

describe('ML Rollback - Auto Rollback 5', () => {
it('should rollback model when prediction error is greater than threshold', () => {
const predictionError = 10;
const modelName = 'model-5';

autoRollback5(predictionError, modelName);

expect(useModel(modelName)).toBe(null);
});

it('should not rollback model when prediction error is less than or equal to threshold', () => {
const predictionError = 5;
const modelName = 'model-5';

autoRollback5(predictionError, modelName);

expect(useModel(modelName)).not.toBe(null);
});
});
