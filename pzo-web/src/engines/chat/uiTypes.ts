/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT UI TYPES COMPATIBILITY BRIDGE
 * FILE: pzo-web/src/engines/chat/uiTypes.ts
 * ============================================================================
 *
 * This file exists only as a migration bridge.
 *
 * Canonical ownership of UI-facing presentation contracts belongs in:
 *   /pzo-web/src/components/chat/uiTypes.ts
 *
 * Engine modules, render shells, and transitional mounts that still import
 * uiTypes from the engine lane may continue to do so through this file until
 * all call sites are moved to the components lane.
 *
 * Runtime law:
 * - UI types stay thin.
 * - Engine truth remains in /pzo-web/src/engines/chat/types.ts.
 * - No simulation ownership may move into this file.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ============================================================================
 */

export * from '../components/chat/uiTypes';
