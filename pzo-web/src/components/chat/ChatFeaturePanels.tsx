/**
 * ============================================================================
 * POINT ZERO ONE — MODE-AWARE CHAT FEATURE PANELS
 * FILE: pzo-web/src/components/chat/ChatFeaturePanels.tsx
 * ============================================================================
 */
import React, { useMemo } from 'react';
import { useChatEngine } from './useChatEngine';
import type { GameChatContext, SabotageEvent } from './chatTypes';
import AlliancePanel, { type ActiveRivalry, type AlliancePanelProps } from './AlliancePanel';
import RoomManager, { type RoomManagerProps } from './RoomManager';
import SovereignChat from './SovereignChat';
import WarRoomPanel, { type DealRoomRivalrySummary } from './WarRoomPanel';
export type GameModeKey = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';
export interface ChatFeaturePanelsProps { readonly mode: GameModeKey; readonly gameCtx: GameChatContext; readonly accessToken?: string | null; readonly currentUserId?: string; readonly onSabotage?: (event: SabotageEvent) => void; readonly alliancePanel?: Omit<AlliancePanelProps, 'channel'> | null; readonly rivalry?: DealRoomRivalrySummary | null; readonly roomManager?: RoomManagerProps | null; readonly showRoomManager?: boolean; readonly showAlliancePanel?: boolean; readonly showDealRoomPanel?: boolean; readonly onAlertClick?: (rivalryId: string) => void; }
function deriveAllianceDefaults(rivalry: DealRoomRivalrySummary | null | undefined): ActiveRivalry | null { if (!rivalry) return null; return { rivalryId: rivalry.rivalryId, phase: rivalry.phase, phaseEndsAt: rivalry.phaseEndsAt, challengerSyndicateId: 'challenger', defenderSyndicateId: 'defender', challengerName: rivalry.challengerName, defenderName: rivalry.defenderName, challengerBanner: '', defenderBanner: '', challengerScore: rivalry.challengerScore, defenderScore: rivalry.defenderScore, mySyndicateId: rivalry.myScore === rivalry.challengerScore ? 'challenger' : 'defender', dealRoomChannel: 'DEAL_ROOM' }; }
export const ChatFeaturePanels: React.FC<ChatFeaturePanelsProps> = ({ mode, gameCtx, accessToken, currentUserId, onSabotage, alliancePanel, rivalry, roomManager, showRoomManager = false, showAlliancePanel = true, showDealRoomPanel = true, onAlertClick }) => { const engine = useChatEngine(gameCtx, accessToken, onSabotage); const activeRivalry = useMemo(() => deriveAllianceDefaults(rivalry), [rivalry]); return <div style={{ display: 'grid', gridTemplateColumns: showAlliancePanel || showRoomManager ? '320px minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 16, minHeight: 0, height: '100%' }}>{showAlliancePanel || showRoomManager ? <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>{showAlliancePanel && mode === 'co-op' && alliancePanel ? <AlliancePanel {...alliancePanel} channel="SYNDICATE" activeRivalry={alliancePanel.activeRivalry ?? activeRivalry} /> : null}{showRoomManager && roomManager ? <RoomManager {...roomManager} /> : null}</div> : null}<div style={{ minWidth: 0, minHeight: 0 }}>{showDealRoomPanel && rivalry && engine.activeChannel === 'DEAL_ROOM' ? <WarRoomPanel engineState={engine} currentUserId={currentUserId} rivalry={rivalry} /> : <SovereignChat engineState={engine} currentUserId={currentUserId} onAlertClick={onAlertClick} />}</div></div>; };
export default ChatFeaturePanels;
