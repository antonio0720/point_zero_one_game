/** Lightweight player response classifier used by shell chat adaptation. */
export type PlayerTone = 'CALM' | 'QUESTION' | 'ANGRY' | 'FLEX' | 'TROLL' | 'UNKNOWN';

export interface PlayerResponseSignal {
  tone: PlayerTone;
  mentionsMoney: boolean;
  mentionsBots: boolean;
  mentionsHelp: boolean;
}

export function classifyPlayerResponse(body: string): PlayerResponseSignal {
  const lower = body.toLowerCase();
  const tone: PlayerTone = /(trash|garbage|broken|stupid|hate)/.test(lower)
    ? 'ANGRY'
    : /(won|easy|million|net worth|dominated)/.test(lower)
      ? 'FLEX'
      : /(lol|lmao|cope|ratio)/.test(lower)
        ? 'TROLL'
        : /(\?|help|how|what|why)/.test(lower)
          ? 'QUESTION'
          : body.trim()
            ? 'CALM'
            : 'UNKNOWN';
  return {
    tone,
    mentionsMoney: /(cash|income|expenses|debt|worth|money|card)/.test(lower),
    mentionsBots: /(bot|liquidator|bureaucrat|manipulator|crash prophet)/.test(lower),
    mentionsHelp: /(help|how|what should|tip|advice)/.test(lower),
  };
}
