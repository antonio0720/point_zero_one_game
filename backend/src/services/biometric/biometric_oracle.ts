/**
 * BiometricOracle service for Point Zero One Digital's financial roguelike game.
 */

import { ClientStressScore, CardEffectMultiplier } from './interfaces';
import { CardEffectsExecutor } from '../card_effects_executor';
import { Logger } from '../logger';
import { ConsentManager } from '../consent_manager';

/**
 * BiometricOracle class for receiving stress scores, computing multipliers, and injecting them into the card effects executor.
 */
export class BiometricOracle {
  private readonly cardEffectsExecutor: CardEffectsExecutor;
  private readonly logger: Logger;
  private readonly consentManager: ConsentManager;

  /**
   * Initializes a new instance of the BiometricOracle class with the provided dependencies.
   * @param cardEffectsExecutor The CardEffectsExecutor instance to inject multipliers into.
   * @param logger The Logger instance for logging actions and messages.
   * @param consentManager The ConsentManager instance for managing user consents.
   */
  constructor(
    cardEffectsExecutor: CardEffectsExecutor,
    logger: Logger,
    consentManager: ConsentManager
  ) {
    this.cardEffectsExecutor = cardEffectsExecutor;
    this.logger = logger;
    this.consentManager = consentManager;
  }

  /**
   * Processes a client's stress score and applies the computed multiplier to the card effects executor.
   * @param stressScore The client's stress score.
   */
  public processStressScore(stressScore: ClientStressScore): void {
    // Consent check before processing
    if (!this.consentManager.hasConsent()) {
      this.logger.info('Consent not granted, skipping biometric processing.');
      return;
    }

    const multiplier = this.computeMultiplier(stressScore);
    this.cardEffectsExecutor.injectMultiplier(multiplier);
    this.logAppliedMultiplier(multiplier);
  }

  /**
   * Computes the card effect multiplier based on the provided stress score.
   * @param stressScore The client's stress score.
   * @returns The computed card effect multiplier.
   */
  private computeMultiplier(stressScore: ClientStressScore): CardEffectMultiplier {
    // Implement your deterministic multiplier computation logic here.
    return 1.0; // Placeholder for the actual implementation.
  }

  /**
   * Logs the applied multiplier without revealing raw stress score details.
   * @param multiplier The applied card effect multiplier.
   */
  private logAppliedMultiplier(multiplier: CardEffectMultiplier): void {
    this.logger.info(`Applied multiplier: ${multiplier}`);
  }
}
