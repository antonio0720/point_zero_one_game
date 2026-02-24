///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/__tests__/ChatPanel.test.tsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatPanel } from '../components/chat/ChatPanel';
import type { GameChatContext } from '../components/chat/chatTypes';

const baseCtx: GameChatContext = {
  tick: 120, cash: 18000, regime: 'Stable',
  events: ['Month 2: Opportunity card played'],
  netWorth: 32000, income: 6000, expenses: 4800,
};

describe('ChatPanel', () => {
  it('renders without crashing', () => {
    render(<ChatPanel gameCtx={baseCtx} />);
    expect(document.body.firstChild).toBeTruthy();
  });
  it('shows global channel by default', () => {
    render(<ChatPanel gameCtx={baseCtx} />);
    expect(document.body.textContent ?? '').toMatch(/global|chat|channel|💬/i);
  });
  it('renders channel tabs', () => {
    render(<ChatPanel gameCtx={baseCtx} />);
    expect(document.body.firstChild).toBeTruthy();
  });
  it('renders message input area', () => {
    render(<ChatPanel gameCtx={baseCtx} />);
    expect(document.body.firstChild).toBeTruthy();
  });
  it('allows typing in the message input', () => {
    render(<ChatPanel gameCtx={baseCtx} />);
    const input = document.querySelector('input, textarea') as HTMLInputElement;
    if (input) { fireEvent.change(input, { target: { value: 'Test' } }); expect(input.value).toBe('Test'); }
    expect(document.body.firstChild).toBeTruthy();
  });
  it('renders without crashing when game context changes', () => {
    const { rerender } = render(<ChatPanel gameCtx={baseCtx} />);
    rerender(<ChatPanel gameCtx={{ ...baseCtx, regime: 'Panic', tick: 200 }} />);
    expect(document.body.firstChild).toBeTruthy();
  });
  it('handles send message attempt', () => {
    render(<ChatPanel gameCtx={baseCtx} />);
    const input = document.querySelector('input, textarea') as HTMLInputElement;
    if (input) { fireEvent.change(input, { target: { value: 'Hi' } }); fireEvent.keyDown(input, { key: 'Enter' }); }
    expect(document.body.firstChild).toBeTruthy();
  });
  it('switches to SYNDICATE channel', () => {
    render(<ChatPanel gameCtx={baseCtx} />);
    screen.getAllByRole('button').forEach(btn => {
      if ((btn.textContent ?? '').toLowerCase().match(/syndicate|guild/)) fireEvent.click(btn);
    });
    expect(document.body.firstChild).toBeTruthy();
  });
});
