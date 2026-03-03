// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE DIGITAL — CONFIG BARREL EXPORT
// pzo_engine/src/config/index.ts
//
// Single import entry point for the entire config layer.
//
// IMPORT PATTERN:
//   import { STARTING_CASH, MODE_EMPIRE, WEIGHT_DECISION_SPEED } from '../config';
//   import { getModeConfig, type ModeConfig } from '../config';
//   import { RULESET_VERSION, isVersionCompatible } from '../config';
//
// Density6 LLC · Point Zero One · Engine Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

export * from './pzo_constants';
export * from './ruleset-version';
export * from './mode-config';