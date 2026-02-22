import { MetricsPipeline1 } from '../metrics-pipeline-1';
import { MetricType, Sample } from '../../../common/interfaces';
import { createTestClock } from 'jest-mock-clock';

describe('MetricsPipeline1', () => {
const testClock = createTestClock();
beforeEach(() => {
testClock.install();
});

afterEach(() => {
testClock.uninstall();
});

it('should process metrics correctly', () => {
// given
const pipeline = new MetricsPipeline1();
const metricSample: Sample = {
timestamp: 1633830400000,
type: MetricType.CPU_UTILIZATION,
value: 0.75,
};

// when
pipeline.processMetric(metricSample);

// then
const expectedBuffer = [metricSample];
expect(pipeline.getMetrics()).toEqual(expectedBuffer);
});

it('should handle multiple metrics', () => {
// given
const pipeline = new MetricsPipeline1();
const metricSample1: Sample = {
timestamp: 1633830400000,
type: MetricType.CPU_UTILIZATION,
value: 0.75,
};
const metricSample2: Sample = {
timestamp: 1633830405000,
type: MetricType.MEMORY_USAGE,
value: 50,
};

// when
pipeline.processMetric(metricSample1);
pipeline.processMetric(metricSample2);

// then
const expectedBuffer = [metricSample1, metricSample2];
expect(pipeline.getMetrics()).toEqual(expectedBuffer);
});
});
