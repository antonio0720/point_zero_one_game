import { AlertRule } from "../../alert-rules";
import { MetricDataSource } from "../../data-sources";
import { ThresholdViolation } from "../../threshold-violations";
import { Alert } from "../alerts";
import { Metric, MetricValue } from "../metrics";
import { AlertManagerClient, AckState } from "@google-cloud/pubsub-lite";
import { pubsub } from "@google-cloud/pubsub";

describe("AlertRules", () => {
let alertRule: AlertRule;
let metricDataSource: MetricDataSource;
let metric: Metric;
let thresholdViolation: ThresholdViolation;
let alertManagerClient: AlertManagerClient;
let pubsubClient: pubsub.PublishClient;

beforeEach(() => {
metricDataSource = new MetricDataSource();
metric = new Metric("test-metric", "test-namespace");
thresholdViolation = new ThresholdViolation(10, 20);
alertRule = new AlertRule("test-rule", metric, thresholdViolation);

alertManagerClient = new AlertManagerClient();
pubsubClient = new pubsub.PublishClient();
});

it("should create an alert when the threshold is violated", async () => {
// Given
const initialValue: MetricValue = { value: 15, timestamp: Date.now() };
metricDataSource.getLatestValue = jest.fn().mockResolvedValue(initialValue);

// When
await alertRule.evaluate();

// Then
expect(alertManagerClient.createAlert).not.toHaveBeenCalled();

// Given - threshold violated
const updatedValue: MetricValue = { value: 25, timestamp: Date.now() };
metricDataSource.getLatestValue.mockClear().mockResolvedValue(updatedValue);

// When
await alertRule.evaluate();

// Then
expect(alertManagerClient.createAlert).toHaveBeenCalledWith({
title: "test-rule: Alert",
description: `The value of test-metric in test-namespace exceeded the threshold of 20`,
state: AckState.UNACKED,
});
});

it("should not create an alert when the threshold is not violated", async () => {
// Given
const initialValue: MetricValue = { value: 5, timestamp: Date.now() };
metricDataSource.getLatestValue = jest.fn().mockResolvedValue(initialValue);

// When
await alertRule.evaluate();

// Then
expect(alertManagerClient.createAlert).not.toHaveBeenCalled();
});

it("should acknowledge an existing alert", async () => {
// Given
const initialValue: MetricValue = { value: 25, timestamp: Date.now() };
metricDataSource.getLatestValue = jest.fn().mockResolvedValue(initialValue);

// When - create an alert
await alertRule.evaluate();

// Then
const createdAlert = alertManagerClient.createAlert as jest.Mock;
const alertId = createdAlert.mock.results[0].arguments[0].alertId;

// Given - acknowledge the alert
await alertRule.acknowledgeAlert(alertId);

// Then
expect(alertManagerClient.updateAlert).toHaveBeenCalledWith({
alertId,
state: AckState.ACKED,
});
});

it("should reject when attempting to acknowledge a non-existent alert", async () => {
// Given
const nonExistentAlertId = "non-existent-alert-id";

// Then
expect(alertRule.acknowledgeAlert(nonExistentAlertId)).rejects.toThrow();
});
});
