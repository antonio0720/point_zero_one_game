import { MetricsModel } from '../metrics-models';
import { DummyDatabase } from '../../mocks/dummy-database';
import { Metric } from '../../entities/metric';

describe('MetricsModels', () => {
let metricsModel: MetricsModel;
let db: DummyDatabase;

beforeEach(() => {
db = new DummyDatabase();
metricsModel = new MetricsModel(db);
});

it('should create a new metric', async () => {
const newMetric = new Metric('test_metric', 'Test Metric Description');

await metricsModel.createMetric(newMetric);

const savedMetrics = await db.getAllMetrics();
expect(savedMetrics).toContainEqual(newMetric);
});

it('should update an existing metric', async () => {
const newMetric = new Metric('test_metric', 'Test Metric Description');
await metricsModel.createMetric(newMetric);

const updatedMetric = new Metric('updated_test_metric', 'Updated Test Metric Description');
updatedMetric.id = (await db.getAllMetrics())[0].id;

await metricsModel.updateMetric(updatedMetric);

const savedMetrics = await db.getAllMetrics();
expect(savedMetrics).toContainEqual(updatedMetric);
});

it('should delete a metric by id', async () => {
const newMetric = new Metric('test_metric', 'Test Metric Description');
await metricsModel.createMetric(newMetric);

const metricId = (await db.getAllMetrics())[0].id;
await metricsModel.deleteMetricById(metricId);

const savedMetrics = await db.getAllMetrics();
expect(savedMetrics).not.toContainEqual(newMetric);
});
});
