import { AlertRule } from '../../alert-rules';
import { MetricDataSource } from '../../data-sources/metric-data-source';
import { AlertManagerClient } from 'prom-client';
import { prometheus } from '@google-cloud/prometheus';

jest.mock('@google-cloud/prometheus');

describe('Alert Rule', () => {
let alertRule: AlertRule;
const dataSource = new MetricDataSource();
const alertManagerClient = new AlertManagerClient();
const prometheusClientMock = prometheus.client as jest.Mocked<prometheus.Client>;

beforeEach(() => {
alertRule = new AlertRule('test-rule', dataSource, alertManagerClient);
prometheusClientMock.register.mockReset();
});

it('should create an alert rule', () => {
expect(alertRule).toBeInstanceOf(AlertRule);
});

it('should register a new alert with the AlertManager', () => {
const metric = new prometheus.Gauge({ name: 'test_metric' });
dataSource.addMetric(metric);
const ruleConfig = {
alertname: 'Test Alert',
expr: 'test_metric > 10',
for: ['5m'],
labels: { severity: 'critical' },
};

alertRule.configure(ruleConfig);

expect(prometheusClientMock.register.mock.calls[0][0]).toEqual(alertRule.configuredRule);
});

it('should update an existing alert with the AlertManager', () => {
const metric = new prometheus.Gauge({ name: 'test_metric' });
dataSource.addMetric(metric);
const ruleConfig = {
alertname: 'Test Alert',
expr: 'test_metric > 10',
for: ['5m'],
labels: { severity: 'critical' },
};
const existingRule = new prometheus.Alert({ ...ruleConfig, annotations: { description: 'Initial Alert Description' } });
prometheusClientMock.register.mockImplementationOnce(() => existingRule);

alertRule.configure(ruleConfig);

expect(prometheusClientMock.register.mock.calls[1][0]).toEqual({ ...existingRule, annotations: { description: 'Updated Alert Description' } });
});
});
