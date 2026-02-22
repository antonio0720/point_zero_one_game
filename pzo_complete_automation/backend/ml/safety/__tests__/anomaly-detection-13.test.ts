import { AnomalyDetection13 } from '../anomaly-detection-13';
import { Dataset, Example } from '../../data';
import { expect } from 'chai';
import sinon from 'sinon';

describe('Anomaly Detection 13', () => {
let anomalyDetection: AnomalyDetection13;
let dataset: Dataset;

beforeEach(() => {
anomalyDetection = new AnomalyDetection13();
dataset = new Dataset();
});

it('should correctly classify examples', () => {
const example1 = new Example({ feature1: 5, feature2: 7 });
const example2 = new Example({ feature1: 0.5, feature2: 0.7 });
dataset.addExample(example1);
dataset.addExample(example2);

anomalyDetection.train(dataset);
const result1 = anomalyDetection.classify(example1);
const result2 = anomalyDetection.classify(example2);

expect(result1).to.equal(0); // normal
expect(result2).to.equal(1); // anomaly
});

it('should handle empty dataset', () => {
const anomalyDetection = new AnomalyDetection13();
const dataset = new Dataset();

expect(() => anomalyDetection.train(dataset)).to.not.throw();
});

it('should throw error when classifying with untrained model', () => {
const example = new Example({ feature1: 5, feature2: 7 });

expect(() => anomalyDetection.classify(example)).to.throw();
});
});
