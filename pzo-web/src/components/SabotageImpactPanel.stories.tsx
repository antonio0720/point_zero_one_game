/**
 * SabotageImpactPanel.stories.tsx — PZO_FE_T0163
 * Storybook stories for SabotageImpactPanel
 */

import type { Meta, StoryObj } from '@storybook/react';
import { SabotageImpactPanel } from './SabotageImpactPanel';

const meta: Meta<typeof SabotageImpactPanel> = {
  title: 'PZO/Sabotage/SabotageImpactPanel',
  component: SabotageImpactPanel,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof SabotageImpactPanel>;

export const NoActiveSabotages: Story = {
  name: 'Empty (no sabotages)',
  args: {
    activeSabotages: [],
    tick: 120,
  },
};

export const SingleMinorSabotage: Story = {
  name: 'Single MINOR sabotage',
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
        impactValue: 500,
      },
    ],
  },
};

export const MultipleSabotages: Story = {
  name: 'Multiple sabotages (MAJOR + CRITICAL)',
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
      },
      {
        id: 'sab-2',
        kind: 'FORCED_SELL',
        label: 'Forced Liquidation',
        severity: 'CRITICAL',
        ticksRemaining: 6,
        sourceDisplayName: 'APEX_GUILD',
        impactValue: 8000,
      },
      {
        id: 'sab-3',
        kind: 'HATER_BOOST',
        label: 'Hater Amplifier',
        severity: 'MAJOR',
        ticksRemaining: 36,
        sourceDisplayName: 'RIVAL_47',
      },
    ],
  },
};

export const WithCounterplay: Story = {
  name: 'With counterplay handler',
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
      },
    ],
  },
};

export const AllKinds: Story = {
  name: 'All sabotage kinds',
  args: {
    tick: 400,
    activeSabotages: [
      { id: 's1', kind: 'INCOME_DRAIN',   label: 'Income Drain',   severity: 'MINOR',    ticksRemaining: 30, sourceDisplayName: 'P1', impactValue: 200 },
      { id: 's2', kind: 'CARD_BLOCK',     label: 'Card Block',     severity: 'MAJOR',    ticksRemaining: 15, sourceDisplayName: 'P2' },
      { id: 's3', kind: 'INTEL_BLACKOUT', label: 'Intel Blackout', severity: 'MAJOR',    ticksRemaining: 20, sourceDisplayName: 'P3' },
      { id: 's4', kind: 'FORCED_SELL',    label: 'Forced Sell',    severity: 'CRITICAL', ticksRemaining: 5,  sourceDisplayName: 'P4', impactValue: 5000 },
      { id: 's5', kind: 'HATER_BOOST',    label: 'Hater Boost',    severity: 'MINOR',    ticksRemaining: 48, sourceDisplayName: 'P5' },
    ],
  },
};