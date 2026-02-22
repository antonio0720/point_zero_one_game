/**
 * Metrics Onboarding Arc
 */

import { Metric } from './metric';

export class MetricsOnboardingArc {
  private stageProgression: Metric;
  private timeToFirstRun: Metric;
  private timeToProof: Metric;
  private afterScreenCTAClickthrough: Metric;
  private conversionRate: Metric;
  private d1RetentionDelta: Metric;
  private d7RetentionDelta: Metric;

  constructor() {
    this.stageProgression = new Metric('OnboardingStageProgression', 'The percentage of players who have completed each stage in the onboarding process.');
    this.timeToFirstRun = new Metric('TimeToFirstRun', 'The time it takes for a player to run their first game after starting the onboarding process.');
    this.timeToProof = new Metric('TimeToProof', 'The time it takes for a player to complete the proof-of-concept stage in the onboarding process.');
    this.afterScreenCTAClickthrough = new Metric('AfterScreenCTAClickthroughRate', 'The percentage of players who click through the CTA after viewing the post-game screen.');
    this.conversionRate = new Metric('ConversionRate', 'The percentage of players who convert to premium users after completing the onboarding process.');
    this.d1RetentionDelta = new Metric('D1RetentionDelta', 'The difference in percentage between Day 1 and Day 0 retention rates.');
    this.d7RetentionDelta = new Metric('D7RetentionDelta', 'The difference in percentage between Day 7 and Day 1 retention rates.');
  }

  public getStageProgression(): Metric {
    return this.stageProgression;
  }

  public setStageProgression(value: Metric): void {
    this.stageProgression = value;
  }

  public getTimeToFirstRun(): Metric {
    return this.timeToFirstRun;
  }

  public setTimeToFirstRun(value: Metric): void {
    this.timeToFirstRun = value;
  }

  public getTimeToProof(): Metric {
    return this.timeToProof;
  }

  public setTimeToProof(value: Metric): void {
    this.timeToProof = value;
  }

  public getAfterScreenCTAClickthrough(): Metric {
    return this.afterScreenCTAClickthrough;
  }

  public setAfterScreenCTAClickthrough(value: Metric): void {
    this.afterScreenCTAClickthrough = value;
  }

  public getConversionRate(): Metric {
    return this.conversionRate;
  }

  public setConversionRate(value: Metric): void {
    this.conversionRate = value;
  }

  public getD1RetentionDelta(): Metric {
    return this.d1RetentionDelta;
  }

  public setD1RetentionDelta(value: Metric): void {
    this.d1RetentionDelta = value;
  }

  public getD7RetentionDelta(): Metric {
    return this.d7RetentionDelta;
  }

  public setD7RetentionDelta(value: Metric): void {
    this.d7RetentionDelta = value;
  }
}
