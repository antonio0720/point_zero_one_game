/**
 * ReplayTimeline.stories.tsx — PZO_FE_T0169
 * Storybook stories for ReplayTimeline
 */

import type { Meta, StoryObj } from '@storybook/react';
import { ReplayTimeline } from './ReplayTimeline';

const meta: Meta<typeof ReplayTimeline> = {
  title: 'PZO/Replay/ReplayTimeline',
  component: ReplayTimeline,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ReplayTimeline>;

const sampleEvents = [
  { tick: 24,  kind: 'CARD_PLAYED'     as const, label: 'Played: LEVERAGE LOAN',       netWorthAtTick: 35000,  emoji: '💳' },
  { tick: 48,  kind: 'FATE'            as const, label: 'FATE: Car Breakdown',          netWorthAtTick: 28000,  emoji: '💀' },
  { tick: 96,  kind: 'CARD_PLAYED'     as const, label: 'Played: SIDE HUSTLE',          netWorthAtTick: 42000,  emoji: '💳' },
  { tick: 144, kind: 'REGIME_CHANGE'   as const, label: 'Regime → EXPANSION',           netWorthAtTick: 61000,  emoji: '📈' },
  { tick: 200, kind: 'MILESTONE'       as const, label: 'Crossed $100K net worth',      netWorthAtTick: 104000, emoji: '🎯' },
  { tick: 288, kind: 'FATE'            as const, label: 'FATE: Medical Emergency',      netWorthAtTick: 72000,  emoji: '🏥' },
  { tick: 360, kind: 'BANKRUPTCY_NEAR' as const, label: 'Near bankruptcy — $2K left',  netWorthAtTick: 2100  },
  { tick: 420, kind: 'CARD_PLAYED'     as const, label: 'Played: BRIDGE LOAN',          netWorthAtTick: 18000,  emoji: '💳' },
  { tick: 540, kind: 'REGIME_CHANGE'   as const, label: 'Regime → PANIC',               netWorthAtTick: 8000,   emoji: '📉' },
  { tick: 650, kind: 'MILESTONE'       as const, label: 'Final equity peak $215K',      netWorthAtTick: 215000, emoji: '🏆' },
];

export const WinningRun: Story = {
  name: 'Winning run ($215K)',
  args: {
    events: sampleEvents,
    totalTicks: 720,
    finalNetWorth: 215000,
    seed: 1771904674,
  },
};

export const BankruptRun: Story = {
  name: 'Bankrupt run (-$4K)',
  args: {
    events: sampleEvents.slice(0, 7),
    totalTicks: 720,
    finalNetWorth: -4200,
    seed: 9981234,
  },
};

export const ShortRun: Story = {
  name: 'Short sparse run',
  args: {
    events: [
      { tick: 12, kind: 'CARD_PLAYED' as const, label: 'First card', netWorthAtTick: 30000, emoji: '💳' },
      { tick: 60, kind: 'FATE'        as const, label: 'Bad luck',    netWorthAtTick: 15000, emoji: '💀' },
    ],
    totalTicks: 720,
    finalNetWorth: 15000,
    seed: 42,
  },
};

export const EmptyRun: Story = {
  name: 'Empty run (no events)',
  args: {
    events: [],
    totalTicks: 720,
    finalNetWorth: 28000,
    seed: 1,
  },
};

export const WithScrubCallback: Story = {
  name: 'With scrub callback',
  args: {
    events: sampleEvents,
    totalTicks: 720,
    finalNetWorth: 215000,
    seed: 1771904674,
    onScrub: (tick: number) => console.log('Scrubbed to tick:', tick),
  },
};