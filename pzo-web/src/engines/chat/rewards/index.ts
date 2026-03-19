// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/rewards/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT REWARDS BARREL
 * FILE: pzo-web/src/engines/chat/rewards/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Stable public barrel for the frontend legend / reward lane.
 *
 * This lane owns:
 * - legend detection
 * - reward staging hooks
 * - prestige presentation policy
 *
 * It does not claim final backend authority over replay publication or durable
 * reward entitlements.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

export * from './ChatLegendMomentDetector';
export * from './ChatRewardHooks';
export * from './LegendPresentationPolicy';

export const CHAT_REWARDS_MODULE_NAME = 'PZO_CHAT_REWARDS' as const;
export const CHAT_REWARDS_PUBLIC_MANIFEST = Object.freeze({
  moduleName: CHAT_REWARDS_MODULE_NAME,
  root: '/pzo-web/src/engines/chat/rewards',
  files: Object.freeze([
    'rewards/index.ts',
    'rewards/ChatLegendMomentDetector.ts',
    'rewards/ChatRewardHooks.ts',
    'rewards/LegendPresentationPolicy.ts',
  ] as const),
  authorities: Object.freeze({
    frontendRewardsRoot: '/pzo-web/src/engines/chat/rewards',
    sharedLegendContract: '/shared/contracts/chat/ChatLegend.ts',
    sharedRewardContract: '/shared/contracts/chat/ChatReward.ts',
    componentsUiTypes: '/pzo-web/src/components/chat/uiTypes.ts',
  } as const),
  owns: Object.freeze([
    'legend detection',
    'reward hook state',
    'prestige presentation policy',
  ] as const),
} as const);
