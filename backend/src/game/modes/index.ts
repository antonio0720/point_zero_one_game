/*
 * POINT ZERO ONE — BACKEND MODES 15X GENERATOR
 * Generated at: 2026-03-10T01:26:02.003447+00:00
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 */

export * from './contracts';
export * from './ModeRegistry';
export * from './ModeRuntimeDirector';
export * from './shared/constants';
export * from './shared/helpers';
export * from './shared/card_overlay';
export * from './shared/cord';
export * from './adapters/EmpireModeAdapter';
export * from './adapters/PredatorModeAdapter';
export * from './adapters/SyndicateModeAdapter';
export * from './adapters/PhantomModeAdapter';
