/** App-shell ChatPanel replaced with package-backed omnipresent dock. */
'use client';

import React, { useEffect } from 'react';
import { OmnipresentChatDock } from '@pzo/engine';
import { useChatEngine } from './useChatEngine';
import type { GameEventType } from './chatTypes';

export interface ChatPanelProps {
  gameContext?: Record<string, unknown> | null;
  mode?: string;
  accent?: string;
  accentRgb?: string;
  defaultOpen?: boolean;
  height?: number | string;
  position?: 'fixed' | 'relative' | 'absolute';
}

export default function ChatPanel({ gameContext = null, mode = 'solo', accent = '#818CF8', defaultOpen = false, height = 560, position = 'relative' }: ChatPanelProps) {
  const engine = useChatEngine({ gameContext: gameContext as any, mode, isLobby: !gameContext });

  useEffect(() => {
    if (!defaultOpen && engine.chatOpen) return;
    if (defaultOpen && !engine.chatOpen) engine.toggleChat();
  }, [defaultOpen, engine]);

  return (
    <div style={{ position, width: '100%', maxWidth: 460 }}>
      <OmnipresentChatDock
        runtime={engine.runtime}
        accent={accent}
        height={height}
        title={gameContext ? 'Game Shell Chat' : 'Lobby Chat'}
        subtitle={gameContext ? 'Package-backed platform shell runtime' : 'Pre-run comms'}
        defaultView="chat"
      />
    </div>
  );
}

export type { GameEventType };
