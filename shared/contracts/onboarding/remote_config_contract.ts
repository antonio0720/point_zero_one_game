/**
 * Remote Config Contract for Arc Tuning
 */

export interface EventInjectionConfig {
  /**
   * Unique identifier for the event injection configuration.
   */
  id: string;

  /**
   * The name of the event to inject.
   */
  eventName: string;

  /**
   * The probability of the event occurring.
   */
  probability: number;
}

export interface OverlayConfig {
  /**
   * Unique identifier for the overlay configuration.
   */
  id: string;

  /**
   * The name of the overlay.
   */
  overlayName: string;

  /**
   * The probability of the overlay being applied.
   */
  probability: number;
}

export interface CockpitModuleConfig {
  /**
   * Unique identifier for the cockpit module configuration.
   */
  id: string;

  /**
   * The name of the cockpit module.
   */
  moduleName: string;

  /**
   * The probability of the cockpit module being activated.
   */
  probability: number;
}

export interface MacroTwistTimingConfig {
  /**
   * Unique identifier for the macro twist timing configuration.
   */
  id: string;

  /**
   * The name of the macro twist.
   */
  macroTwistName: string;

  /**
   * The delay before the macro twist is applied.
   */
  delay: number;
}
