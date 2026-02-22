import { AnomalyDetection } from '../anomaly-detection';
import { DataPoint } from '../data-point';
import { expect } from 'expect';

describe('Anomaly Detection', () => {
let anomalyDetector: AnomalyDetection;

beforeEach(() => {
anomalyDetector = new AnomalyDetection();
});

it('should return false for normal data points', () => {
const dataPoint1 = new DataPoint(50, 60);
const dataPoint2 = new DataPoint(40, 70);
const result1 = anomalyDetector.isAnomalous(dataPoint1);
const result2 = anomalyDetector.isAnomalous(dataPoint2);

expect(result1).toBeFalsy();
expect(result2).toBeFalsy();
});

it('should return true for anomalous data points', () => {
const dataPoint1 = new DataPoint(100, 150);
const result1 = anomalyDetector.isAnomalous(dataPoint1);

expect(result1).toBeTruthy();
});

it('should throw an error if the input data point is not valid', () => {
expect(() => anomalyDetector.isAnomalous({})).toThrowError('Invalid Data Point');
expect(() => anomalyDetector.isAnomalous(null)).toThrowError('Invalid Data Point');
});
});
