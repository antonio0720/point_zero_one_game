/** Shell adaptive dialogue generator built on classifier + helper + bot trees. */
import type { ChatMessage } from './chatTypes';
import { classifyPlayerResponse } from './PlayerResponseClassifier';
import { buildHelperReply } from './HelperCharacters';
import { buildBotReply } from './HaterDialogueTrees';

function stamp(message: Omit<ChatMessage, 'id' | 'createdAt'>, suffix: string): ChatMessage {
  return {
    ...message,
    id: `${suffix}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  };
}

export function buildAdaptiveMessages(body: string): ChatMessage[] {
  const signal = classifyPlayerResponse(body);
  const messages: ChatMessage[] = [];
  if (signal.tone !== 'UNKNOWN') {
    messages.push(stamp({ channel: 'GLOBAL', kind: 'PLAYER_RESPONSE', senderId: 'SYSTEM', senderName: 'SYSTEM', body: `Tone detected: ${signal.tone}.`, immutable: true, wasAdapted: true, sentimentSignal: signal.tone }, 'adapt_player'));
  }
  if (signal.mentionsHelp || signal.mentionsMoney || signal.mentionsBots) {
    messages.push(stamp(buildHelperReply(signal), 'adapt_helper'));
  }
  if (signal.tone === 'ANGRY' || signal.tone === 'FLEX' || signal.mentionsBots) {
    messages.push(stamp(buildBotReply(signal), 'adapt_bot'));
  }
  return messages;
}

