/**
 * SabotageImpactPanel.stories.tsx — PZO_FE_T0163 · Engine-Integrated
 * Updated for BotId / BotState engine integration
 * Density6 LLC · Point Zero One · Confidential
 */

import type { Meta, StoryObj } from '@storybook/react';
import { SabotageImpactPanel } from './SabotageImpactPanel';
import { BotId, BotState } from '../engines/battle/types';

const meta: Meta<typeof SabotageImpactPanel> = {
  title: 'PZO/Sabotage/SabotageImpactPanel',
  component: SabotageImpactPanel,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark', values: [{ name: 'dark', value: '#030308' }] },
  },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof SabotageImpactPanel>;

export const NoActiveSabotages: Story = {
  name: 'Empty — no sabotages',
  args: {
    activeSabotages: [],
    tick: 120,
  },
};

export const SingleMinor: Story = {
  name: 'MINOR · Income Siphon',
  args: {
    tick: 88,
    activeSabotages: [
      {
        id: 'sab-1',
        kind: 'INCOME_DRAIN',
        label: 'Income Siphon',
        severity: 'MINOR',
        ticksRemaining: 24,
        sourceDisplayName: 'RIVAL_47',
        sourceBotId: BotId.BOT_01_LIQUIDATOR,
        sourceBotState: BotState.ATTACKING,
        impactValue: 500,
      },
    ],
  },
};

export const MultipleAttacks: Story = {
  name: 'MAJOR + CRITICAL · Multi-vector',
  args: {
    tick: 240,
    activeSabotages: [
      {
        id: 'sab-1',
        kind: 'CARD_BLOCK',
        label: 'Card Lock',
        severity: 'MAJOR',
        ticksRemaining: 18,
        sourceDisplayName: 'THE_SYNDICATE',
        sourceBotId: BotId.BOT_03_MANIPULATOR,
        sourceBotState: BotState.ATTACKING,
      },
      {
        id: 'sab-2',
        kind: 'FORCED_SELL',
        label: 'Forced Liquidation',
        severity: 'CRITICAL',
        ticksRemaining: 6,
        sourceDisplayName: 'APEX_GUILD',
        sourceBotId: BotId.BOT_04_CRASH_PROPHET,
        sourceBotState: BotState.ATTACKING,
        impactValue: 8000,
      },
      {
        id: 'sab-3',
        kind: 'HATER_BOOST',
        label: 'Hater Amplifier',
        severity: 'MAJOR',
        ticksRemaining: 36,
        sourceDisplayName: 'RIVAL_47',
        sourceBotId: BotId.BOT_02_BUREAUCRAT,
        sourceBotState: BotState.TARGETING,
      },
    ],
  },
};

export const WithCounterplay: Story = {
  name: 'CRITICAL · With counterplay handler',
  args: {
    tick: 300,
    onCounterplay: (id: string) => console.log('Counterplay triggered:', id),
    activeSabotages: [
      {
        id: 'sab-1',
        kind: 'INTEL_BLACKOUT',
        label: 'Intel Blackout',
        severity: 'CRITICAL',
        ticksRemaining: 12,
        sourceDisplayName: 'CIPHER_NET',
        sourceBotId: BotId.BOT_05_LEGACY_HEIR,
        sourceBotState: BotState.ATTACKING,
      },
    ],
  },
};

export const AllKinds: Story = {
  name: 'All sabotage kinds · All severities',
  args: {
    tick: 400,
    onCounterplay: (id: string) => console.log('Counter:', id),
    activeSabotages: [
      {
        id: 's1',
        kind: 'INCOME_DRAIN',
        label: 'Income Drain',
        severity: 'MINOR',
        ticksRemaining: 30,
        sourceDisplayName: 'P1',
        sourceBotId: BotId.BOT_01_LIQUIDATOR,
        sourceBotState: BotState.WATCHING,
        impactValue: 200,
      },
      {
        id: 's2',
        kind: 'CARD_BLOCK',
        label: 'Card Block',
        severity: 'MAJOR',
        ticksRemaining: 15,
        sourceDisplayName: 'P2',
        sourceBotId: BotId.BOT_02_BUREAUCRAT,
        sourceBotState: BotState.ATTACKING,
      },
      {
        id: 's3',
        kind: 'INTEL_BLACKOUT',
        label: 'Intel Blackout',
        severity: 'MAJOR',
        ticksRemaining: 20,
        sourceDisplayName: 'P3',
        sourceBotId: BotId.BOT_03_MANIPULATOR,
        sourceBotState: BotState.TARGETING,
      },
      {
        id: 's4',
        kind: 'FORCED_SELL',
        label: 'Forced Sell',
        severity: 'CRITICAL',
        ticksRemaining: 5,
        sourceDisplayName: 'P4',
        sourceBotId: BotId.BOT_04_CRASH_PROPHET,
        sourceBotState: BotState.ATTACKING,
        impactValue: 5000,
      },
      {
        id: 's5',
        kind: 'HATER_BOOST',
        label: 'Hater Boost',
        severity: 'MINOR',
        ticksRemaining: 48,
        sourceDisplayName: 'P5',
        sourceBotId: BotId.BOT_05_LEGACY_HEIR,
        sourceBotState: BotState.RETREATING,
      },
    ],
  },
};

export const MaxPressure: Story = {
  name: 'MAX PRESSURE — Critical cascade scenario',
  args: {
    tick: 999,
    onCounterplay: (id: string) => console.log('Counter:', id),
    activeSabotages: [
      {
        id: 'c1',
        kind: 'FORCED_SELL',
        label: 'LIQUIDATION ORDER',
        severity: 'CRITICAL',
        ticksRemaining: 2,
        sourceDisplayName: 'CRASH_PROPHET',
        sourceBotId: BotId.BOT_04_CRASH_PROPHET,
        sourceBotState: BotState.ATTACKING,
        impactValue: 15000,
      },
      {
        id: 'c2',
        kind: 'INCOME_DRAIN',
        label: 'Revenue Siphon',
        severity: 'CRITICAL',
        ticksRemaining: 4,
        sourceDisplayName: 'THE_SYNDICATE',
        sourceBotId: BotId.BOT_01_LIQUIDATOR,
        sourceBotState: BotState.ATTACKING,
        impactValue: 9500,
      },
      {
        id: 'c3',
        kind: 'INTEL_BLACKOUT',
        label: 'Full Blackout',
        severity: 'CRITICAL',
        ticksRemaining: 8,
        sourceDisplayName: 'CIPHER_GUILD',
        sourceBotId: BotId.BOT_05_LEGACY_HEIR,
        sourceBotState: BotState.ATTACKING,
      },
    ],
  },
};