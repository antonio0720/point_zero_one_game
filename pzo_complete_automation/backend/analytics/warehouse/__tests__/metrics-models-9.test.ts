import { MetricsModels9 } from '../../../src/backend/analytics/warehouse/metrics-models-9';
import { IMetricsData } from '../../../src/common/interfaces/IMetricsData';
import { Metric } from '../../../src/common/enums/Metric';
import { IWarehouseData } from '../../../src/backend/analytics/interfaces/IWarehouseData';

describe('MetricsModels9', () => {
let metricsModels9: MetricsModels9;

beforeEach(() => {
metricsModels9 = new MetricsModels9();
});

it('should return correct data for metric A', () => {
const inputData: IWarehouseData[] = [
{
date: new Date(2022, 1 - 1, 1),
metricA: 10,
},
{
date: new Date(2022, 1 - 1, 2),
metricA: 15,
},
];

const expectedData: IMetricsData[] = [
{
date: new Date(2022, 1 - 1, 1),
metric: Metric.METRIC_A,
value: 10,
},
{
date: new Date(2022, 1 - 1, 2),
metric: Metric.METRIC_A,
value: 15,
},
];

expect(metricsModels9.transform(inputData)).toEqual(expectedData);
});

it('should return correct data for metric B', () => {
const inputData: IWarehouseData[] = [
{
date: new Date(2022, 1 - 1, 1),
metricB: 'value1',
},
{
date: new Date(2022, 1 - 1, 2),
metricB: 'value2',
},
];

const expectedData: IMetricsData[] = [
{
date: new Date(2022, 1 - 1, 1),
metric: Metric.METRIC_B,
value: 'value1',
},
{
date: new Date(2022, 1 - 1, 2),
metric: Metric.METRIC_B,
value: 'value2',
},
];

expect(metricsModels9.transform(inputData)).toEqual(expectedData);
});

// Add more test cases as needed for other metrics and edge cases
});
