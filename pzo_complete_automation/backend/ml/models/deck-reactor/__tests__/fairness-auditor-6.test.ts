import { FairnessAuditor6 } from "../fairness-auditor-6";
import { LabeledData } from "../../data/labeled-data";
import { Metrics } from "../../metrics";
import { DatasetSplit } from "../../data/dataset-split";
import { BinaryFairnessMetrics } from "../../metrics/binary-fairness-metrics";
import { DemographicGroup } from "../../data/demographic-group";

describe('FairnessAuditor6', () => {
let fairnessAuditor: FairnessAuditor6;

beforeEach(() => {
fairnessAuditor = new FairnessAuditor6();
});

it('should calculate equality of odds', () => {
const positiveOutcomeRateForMajority = 0.5;
const positiveOutcomeRateForMinority = 0.4;
const falsePositiveRateForMajority = 0.1;
const falsePositiveRateForMinority = 0.2;

const labeledData: LabeledData = {
data: [
// Sample dataset with majority and minority group examples
],
target: 'isPositive',
};

const metrics = new BinaryFairnessMetrics();
const equalityOfOdds = fairnessAuditor.calculateEqualityOfOdds(labeledData, metrics);

expect(equalityOfOdds).toEqual(1 - (positiveOutcomeRateForMinority * falsePositiveRateForMajority) / (positiveOutcomeRateForMajority * falsePositiveRateForMinority));
});

it('should calculate demographic parity', () => {
const positiveOutcomeRateForMajority = 0.5;
const positiveOutcomeRateForMinority = 0.4;

const labeledData: LabeledData = {
data: [
// Sample dataset with majority and minority group examples
],
target: 'isPositive',
};

const demographicGroups: DemographicGroup[] = [
{ name: 'majority', examplesCount: labeledData.data.filter(example => example.demographics.includes('majority')).length },
{ name: 'minority', examplesCount: labeledData.data.filter(example => example.demographics.includes('minority')).length },
];

const metrics = new BinaryFairnessMetrics();
const demographicParity = fairnessAuditor.calculateDemographicParity(labeledData, demographicGroups, metrics);

expect(demographicParity).toEqual(positiveOutcomeRateForMajority - (positiveOutcomeRateForMinority - positiveOutcomeRateForMajority) * demographicGroups[1].examplesCount / demographicGroups[0].examplesCount);
});

it('should calculate disparate impact', () => {
const positiveOutcomeRateForMajority = 0.5;
const positiveOutcomeRateForMinority = 0.4;
const falsePositiveRateForMajority = 0.1;
const falsePositiveRateForMinority = 0.2;

const labeledData: LabeledData = {
data: [
// Sample dataset with majority and minority group examples
],
target: 'isPositive',
};

const demographicGroups: DemographicGroup[] = [
{ name: 'majority', examplesCount: labeledData.data.filter(example => example.demographics.includes('majority')).length },
{ name: 'minority', examplesCount: labeledData.data.filter(example => example.demographics.includes('minority')).length },
];

const metrics = new BinaryFairnessMetrics();
const disparateImpact = fairnessAuditor.calculateDisparateImpact(labeledData, demographicGroups, metrics);

expect(disparateImpact).toEqual((falsePositiveRateForMinority - falsePositiveRateForMajority) / (positiveOutcomeRateForMinority - positiveOutcomeRateForMajority));
});
});
