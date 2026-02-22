import { FairnessAuditor1 } from '../../../core/ml/models/FairnessAuditor1';
import { Classifier } from '../../../core/ml/Classifier';
import { BinaryLabeledData } from '../../../core/data/BinaryLabeledData';
import { Dataset } from '../../../core/data/Dataset';
import { MetricsReport } from '../../../core/metrics/MetricsReport';
import { FairnessMetrics } from '../../../core/metrics/FairnessMetrics';
import { DemographicGroup } from '../../../core/demographics/DemographicGroup';

describe('FairnessAuditor1', () => {
let fairnessAuditor: FairnessAuditor1;
let classifier: Classifier;
let data: BinaryLabeledData[];

beforeEach(() => {
classifier = new Classifier();
fairnessAuditor = new FairnessAuditor1(classifier);
data = [
new BinaryLabeledData([[1, 2], 0], new DemographicGroup('groupA', 0.5)),
new BinaryLabeledData([[3, 4], 1], new DemographicGroup('groupB', 0.5))
];
});

it('should initialize the FairnessAuditor1 with a Classifier', () => {
expect(fairnessAuditor.classifier).toBeInstanceOf(Classifier);
});

it('should return fairness metrics for a given dataset', () => {
fairnessAuditor.train(data);
const metricsReport = fairnessAuditor.evaluate();
const fairnessMetrics = metricsReport.getFairnessMetrics();

expect(fairnessMetrics).toBeInstanceOf(FairnessMetrics);
});

it('should calculate equal opportunity difference', () => {
fairnessAuditor.train(data);
const metricsReport = fairnessAuditor.evaluate();
const fairnessMetrics = metricsReport.getFairnessMetrics();

expect(fairnessMetrics.equalOpportunityDifference).toBeCloseTo(0, 2);
});

it('should calculate disparate impact', () => {
fairnessAuditor.train(data);
const metricsReport = fairnessAuditor.evaluate();
const fairnessMetrics = metricsReport.getFairnessMetrics();

expect(fairnessMetrics.disparateImpact).toBeCloseTo(1, 2);
});
});
