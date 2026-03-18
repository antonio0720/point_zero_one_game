/** Lobby chat widget using package-backed app-shell runtime. */
'use client';

import React from 'react';
import ChatPanel from './ChatPanel';

export interface LobbyChatWidgetProps {
  mode?: string;
  height?: number | string;
}

export default function LobbyChatWidget({ mode = 'lobby', height = 420 }: LobbyChatWidgetProps) {
  return <ChatPanel mode={mode} gameContext={null} defaultOpen height={height} position="relative" />;
}
