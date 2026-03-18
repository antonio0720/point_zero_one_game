/** Bot taunt vocabulary for shell chat adaptation. */
import type { ChatMessage } from './chatTypes';
import type { PlayerResponseSignal } from './PlayerResponseClassifier';

const BOT_POOL = [
  { id: 'BOT_01_LIQUIDATOR', name: 'The Liquidator' },
  { id: 'BOT_02_BUREAUCRAT', name: 'The Bureaucrat' },
  { id: 'BOT_03_MANIPULATOR', name: 'The Manipulator' },
  { id: 'BOT_04_CRASH_PROPHET', name: 'Crash Prophet' },
  { id: 'BOT_05_LEGACY_HEIR', name: 'Legacy Heir' },
] as const;

export function buildBotReply(signal: PlayerResponseSignal): Omit<ChatMessage, 'id' | 'createdAt'> {
  const bot = BOT_POOL[(Date.now() % BOT_POOL.length)];
  let body = 'You are not under pressure. You are defined by it.';
  if (signal.tone === 'FLEX') body = 'Celebrate too early and I will price your arrogance into the next turn.';
  if (signal.tone === 'ANGRY') body = 'Good. Emotion is the cheapest doorway into a bad decision.';
  if (signal.mentionsMoney) body = 'You keep staring at money. I am staring at your weak layer.';
  return {
    channel: 'GLOBAL',
    kind: 'BOT_TAUNT',
    senderId: bot.id,
    senderName: bot.name,
    body,
    immutable: true,
  } as Omit<ChatMessage, 'id' | 'createdAt'>;
}
