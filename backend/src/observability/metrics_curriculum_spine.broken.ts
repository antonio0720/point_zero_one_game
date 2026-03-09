/**
 * Metrics Curriculum Spine
 */

import { Metric } from './metric';

export class MetricsCurriculumSpine {
  private _packAdoption: Metric;
  private _scenarioCompletion: Metric;
  private _repeatAttempts: Metric;
  private _debriefCompletion: Metric;
  private _dashboardViews: Metric;
  private _retentionDeltaPerCohort: Metric;

  constructor() {
    this._packAdoption = new Metric('Pack Adoption', 'The percentage of players who adopt a pack within the first 24 hours');
    this._scenarioCompletion = new Metric('Scenario Completion', 'The percentage of players who complete a scenario');
    this._repeatAttempts = new Metric('Repeat Attempts', 'The average number of attempts to complete a scenario by players');
    this._debriefCompletion = new Metric('Debrief Completion', 'The percentage of players who complete the debrief after a scenario');
    this._dashboardViews = new Metric('Dashboard Views', 'The total number of dashboard views by all players');
    this._retentionDeltaPerCohort = new Metric('Retention Delta Per Cohort', 'The difference in retention rate between cohorts');
  }

  public getPackAdoption(): Metric {
    return this._packAdoption;
  }

  public setPackAdoption(value: Metric): void {
    this._packAdoption = value;
  }

  public getScenarioCompletion(): Metric {
    return this._scenarioCompletion;
  }

  public setScenarioCompletion(value: Metric): void {
    this._scenarioCompletion = value;
  }

  public getRepeatAttempts(): Metric {
    return this._repeatAttempts;
  }

  public setRepeatAttempts(value: Metric): void {
    this._repeatAttempts = value;
  }

  public getDebriefCompletion(): Metric {
    return this._debriefCompletion;
  }

  public setDebriefCompletion(value: Metric): void {
    this._debriefCompletion = value;
  }

  public getDashboardViews(): Metric {
    return this._dashboardViews;
  }

  public setDashboardViews(value: Metric): void {
    this._dashboardViews = value;
  }

  public getRetentionDeltaPerCohort(): Metric {
    return this._retentionDeltaPerCohort;
  }

  public setRetentionDeltaPerCohort(value: Metric): void {
    this._retentionDeltaPerCohort = value;
  }
}
