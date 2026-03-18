/** Game-event to chat bridge for shell adoption. */
import type { ChatMessage, GameEventType } from './chatTypes';

function makeMessage(kind: ChatMessage['kind'], body: string, meta?: Record<string, unknown>): ChatMessage {
  return {
    id: `bridge_${Math.random().toString(36).slice(2, 10)}`,
    channel: kind === 'RIVALRY_BULLETIN' ? 'DEAL_ROOM' : 'GLOBAL',
    kind,
    senderId: 'SYSTEM',
    senderName: 'SYSTEM',
    body,
    createdAt: new Date().toISOString(),
    immutable: true,
    meta,
  };
}

export function bridgeEventToMessages(type: GameEventType, payload: Record<string, unknown> = {}): ChatMessage[] {
  switch (type) {
    case 'RUN_STARTED':
      return [makeMessage('SYSTEM', `Run started${payload.mode ? ` · ${String(payload.mode)}` : ''}.`, payload)];
    case 'RUN_ENDED':
      return [makeMessage('DEAL_RECAP', `Run ended · ${payload.outcome ? String(payload.outcome) : 'UNKNOWN'}.`, payload)];
    case 'PRESSURE_TIER_CHANGED':
      return [makeMessage('MARKET_ALERT', `Pressure shifted to ${payload.tier ? String(payload.tier) : 'UNKNOWN'}.`, payload)];
    case 'BOT_ATTACK':
      return [makeMessage('BOT_ATTACK', payload.body ? String(payload.body) : `Bot attack on ${payload.targetLayer ? String(payload.targetLayer) : 'core'}.`, payload)];
    case 'SHIELD_BREACH':
      return [makeMessage('SHIELD_EVENT', `Shield breach at ${payload.layerId ? String(payload.layerId) : 'unknown layer'}.`, payload)];
    case 'CASCADE_TRIGGERED':
      return [makeMessage('CASCADE_ALERT', `Cascade triggered · ${payload.chainId ? String(payload.chainId) : 'UNNAMED'}.`, payload)];
    case 'SOVEREIGNTY_GRADE_CHANGED':
      return [makeMessage('ACHIEVEMENT', `Sovereignty grade ${payload.grade ? String(payload.grade) : 'UPDATED'}.`, payload)];
    case 'PIPELINE_STATUS_CHANGED':
      return [makeMessage('SYSTEM', `Proof pipeline ${payload.status ? String(payload.status) : 'UPDATED'}.`, payload)];
    case 'RIVALRY_PHASE_CHANGED':
      return [{ ...makeMessage('RIVALRY_BULLETIN', payload.body ? String(payload.body) : `Rivalry phase ${payload.phase ? String(payload.phase) : 'UPDATED'}.`, payload), bulletinPhase: payload.phase as any }];
    case 'MARKET_ALERT':
      return [makeMessage('MARKET_ALERT', payload.body ? String(payload.body) : 'Market alert.', payload)];
    default:
      return [makeMessage('SYSTEM', payload.body ? String(payload.body) : 'System event.', payload)];
  }
}
