import type { FrontendRunMode } from './contracts';
import { MODE_TO_LABEL, MODE_TO_SCREEN } from './shared/constants';

export interface ModeCatalogEntry {
  runMode: FrontendRunMode;
  uiLabel: string;
  screenName: string;
  description: string;
  playerRange: [number, number];
}

export const MODE_CATALOG: Record<FrontendRunMode, ModeCatalogEntry> = {
  solo: {
    runMode: 'solo',
    uiLabel: MODE_TO_LABEL.solo,
    screenName: MODE_TO_SCREEN.solo,
    description: 'The isolated sovereign. Pre-run loadout, phase cadence, isolation tax, bleed mode, and personal mastery.',
    playerRange: [1, 1],
  },
  'asymmetric-pvp': {
    runMode: 'asymmetric-pvp',
    uiLabel: MODE_TO_LABEL['asymmetric-pvp'],
    screenName: MODE_TO_SCREEN['asymmetric-pvp'],
    description: 'Shared deck, battle budget, extractions, counters, psyche pressure, and rivalry surfaces.',
    playerRange: [2, 2],
  },
  'co-op': {
    runMode: 'co-op',
    uiLabel: MODE_TO_LABEL['co-op'],
    screenName: MODE_TO_SCREEN['co-op'],
    description: 'Shared treasury, role assignment, trust score, war alerts, aid/rescue windows, and authored betrayal.',
    playerRange: [2, 4],
  },
  ghost: {
    runMode: 'ghost',
    uiLabel: MODE_TO_LABEL.ghost,
    screenName: MODE_TO_SCREEN.ghost,
    description: 'Legend markers, divergence scoring, challenger stack, dynasty chase, and decay-weighted ghost pressure.',
    playerRange: [1, 1],
  },
};
