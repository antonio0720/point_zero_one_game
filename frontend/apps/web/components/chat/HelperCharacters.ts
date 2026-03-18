/** Helper personas for shell chat adaptation. */
import type { ChatMessage } from './chatTypes';
import type { PlayerResponseSignal } from './PlayerResponseClassifier';

const HELPERS = [
  { id: 'helper_mentor', name: 'Mentor Vale', rank: 'Guide' },
  { id: 'helper_underwriter', name: 'Underwriter Nyx', rank: 'Analyst' },
  { id: 'helper_operator', name: 'Operator Sera', rank: 'Strategist' },
] as const;

export function pickHelper(signal: PlayerResponseSignal) {
  if (signal.mentionsMoney) return HELPERS[1];
  if (signal.mentionsBots) return HELPERS[2];
  return HELPERS[0];
}

export function buildHelperReply(signal: PlayerResponseSignal): Omit<ChatMessage, 'id' | 'createdAt'> {
  const helper = pickHelper(signal);
  let body = 'Stay deliberate. Build the board before forcing speed.';
  if (signal.mentionsMoney) body = 'Watch the cashflow edge first. Income outrunning expenses stabilizes every later choice.';
  if (signal.mentionsBots) body = 'Bots escalate when your board leaks intent. Fortify weak layers before forcing a line.';
  if (signal.mentionsHelp) body = 'Early run: stabilize cashflow, protect shield integrity, and avoid greed in hot pressure tiers.';
  return {
    channel: 'GLOBAL',
    kind: 'HELPER_TIP',
    senderId: helper.id,
    senderName: helper.name,
    senderRank: helper.rank,
    body,
    immutable: false,
  } as Omit<ChatMessage, 'id' | 'createdAt'>;
}
