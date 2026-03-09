/**
 * Alert Engine service for Point Zero One Digital's financial roguelike game.
 */

import { Rule, Incident, Suppression, Ack, RunbookLink } from './interfaces';

/**
 * Evaluate alert rules on rollups, fire incidents, suppressions, acks, and link runbooks.
 */
export class AlertEngine {
  private rules: Rule[];

  constructor() {
    this.rules = [];
  }

  /**
   * Add a new rule to the alert engine.
   * @param rule - The rule to add.
   */
  public addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  /**
   * Evaluate all rules on the given rollups and return a list of incidents, suppressions, acks, and runbook links.
   * @param rollups - The rollups to evaluate.
   */
  public evaluate(rollups: any[]): (Incident[] | Suppression[] | Ack[] | RunbookLink[]) {
    const results: (Incident[] | Suppression[] | Ack[] | RunbookLink[]) = [];

    for (const rule of this.rules) {
      const incidentOrSuppressionOrAckOrRunbookLink = rule.evaluate(rollups);

      if (incidentOrSuppressionOrAckOrRunbookLink instanceof Incident) {
        results.push([incidentOrSuppressionOrAckOrRunbookLink]);
      } else if (Array.isArray(incidentOrSuppressionOrAckOrRunbookLink)) {
        results = results.concat(incidentOrSuppressionOrAckOrRunbookLink);
      }
    }

    return results;
  }
}

/**
 * Interface for alert rules.
 */
export interface Rule {
  /**
   * Evaluates the rule on the given rollups and returns an incident, suppression, ack, or runbook link if applicable.
   * @param rollups - The rollups to evaluate.
   */
  evaluate(rollups: any[]): Incident | Suppression | Ack | RunbookLink | undefined;
}

/**
 * Interface for incidents.
 */
export interface Incident {
  // Add required fields for incident here.
}

/**
 * Interface for suppressions.
 */
export interface Suppression {
  // Add required fields for suppression here.
}

/**
 * Interface for acknowledgements (acks).
 */
export interface Ack {
  // Add required fields for ack here.
}

/**
 * Interface for runbook links.
 */
export interface RunbookLink {
  // Add required fields for runbook link here.
}
