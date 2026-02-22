/**
 * Metrics Monetization Trust Module for Point Zero One Digital
 */

import { Metric } from './metric';

/**
 * Represents a monetization event in the game.
 */
export interface MonetizationEvent {
  offerId: number;
  class: string;
  conversion: boolean;
  refundOrChargeback: boolean;
  interruption: boolean;
}

/**
 * Represents a user's participation in verified ladder events.
 */
export interface VerifiedLadderParticipation {
  userId: number;
  eventId: number;
  level: number;
}

/**
 * Metrics class for tracking monetization and trust-related metrics.
 */
export class MetricsMonetizationTrust extends Metric {
  private _conversionByClass: Map<string, number>;
  private _refundOrChargebackRate: number;
  private _offerInterruptionRate: number;
  private _postOfferChurn: number;
  private _verifiedLadderParticipation: Map<number, Map<number, number>>;

  constructor() {
    super();
    this._conversionByClass = new Map();
    this._refundOrChargebackRate = 0;
    this._offerInterruptionRate = 0;
    this._postOfferChurn = 0;
    this._verifiedLadderParticipation = new Map();
  }

  /**
   * Records a monetization event.
   * @param event - The monetization event to record.
   */
  public recordMonetizationEvent(event: MonetizationEvent): void {
    const { class: eventClass, conversion, refundOrChargeback, interruption } = event;

    this._conversionByClass.set(eventClass, (this._conversionByClass.get(eventClass) || 0) + (conversion ? 1 : 0));
    this._refundOrChargebackRate += refundOrChargeback ? 1 : -1;
    this._offerInterruptionRate += interruption ? 1 : -1;
  }

  /**
   * Records a verified ladder participation event.
   * @param userId - The user's ID.
   * @param eventId - The event's ID.
   * @param level - The user's level in the event.
   */
  public recordVerifiedLadderParticipation(userId: number, eventId: number, level: number): void {
    const userIdEventMap = this._verifiedLadderParticipation.get(userId) || new Map();
    userIdEventMap.set(eventId, level);
    this._verifiedLadderParticipation.set(userId, userIdEventMap);
  }

  /**
   * Returns the conversion rate by class.
   */
  public getConversionByClass(): Map<string, number> {
    return this._conversionByClass;
  }

  /**
   * Returns the refund or chargeback rate.
   */
  public getRefundOrChargebackRate(): number {
    return this._refundOrChargebackRate / this.getTotalMonetizationEvents();
  }

  /**
   * Returns the offer interruption rate.
   */
  public getOfferInterruptionRate(): number {
    return this._offerInterruptionRate / this.getTotalMonetizationEvents();
  }

  /**
   * Returns the post-offer churn rate.
   */
  public getPostOfferChurn(): number {
    return this.getTotalUsers() - this.getActiveUsers() - this.getNewUsers();
  }

  /**
   * Returns the verified ladder participation for a user.
   * @param userId - The user's ID.
   */
  public getVerifiedLadderParticipation(userId: number): Map<number, number> | undefined {
    return this._verifiedLadderParticipation.get(userId);
  }

  /**
   * Returns the total monetization events.
   */
  private getTotalMonetizationEvents(): number {
    let total = 0;
    this._conversionByClass.forEach((value) => (total += value));
    return total;
  }

  /**
   * Returns the total users.
   */
  private getTotalUsers(): number {
    // Implement a method to count all unique users in the system.
    throw new Error('Method not implemented.');
  }

  /**
   * Returns the active users.
   */
  private getActiveUsers(): number {
    // Implement a method to count all active users in the system.
    throw new Error('Method not implemented.');
  }

  /**
   * Returns the new users.
   */
  private getNewUsers(): number {
    // Implement a method to count all new users in the system.
    throw new Error('Method not implemented.');
  }
}
