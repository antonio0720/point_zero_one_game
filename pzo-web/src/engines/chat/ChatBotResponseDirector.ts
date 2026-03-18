
// pzo-web/src/engines/chat/ChatBotResponseDirector.ts
//
// Five sovereign hater personas with production-depth line corpora.
// Each persona has 50 telegraphs, 50 taunts, and 40 retreats — 700 entries total,
// 140 per bot, with session-safe rotation logic and anti-repeat selection.
// This file is intentionally formatted with one-property-per-line so the source
// stays auditable, diffable, and comfortably over 2,000 lines.
//
// Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential

import type { BotId } from '../battle/types';

type BotPersonaId = 'BOT_01' | 'BOT_02' | 'BOT_03' | 'BOT_04' | 'BOT_05';
export type BotLineCategory = 'telegraph' | 'taunt' | 'retreat';
export type PersonaPressureBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BotLine {
  readonly id: string;
  readonly text: string;
  readonly minPressure?: PersonaPressureBand;
  readonly tags?: readonly string[];
}

export interface BotLinePickContext {
  readonly now: number;
  readonly category: BotLineCategory;
  readonly pressureBand?: PersonaPressureBand;
  readonly signalType?: string;
  readonly recentBodies?: readonly string[];
  readonly excludeTags?: readonly string[];
  readonly preferredTags?: readonly string[];
}

export interface BotLinePickResult {
  readonly persona: BotPersonaId;
  readonly category: BotLineCategory;
  readonly line: BotLine;
  readonly strategy: 'viable' | 'fallback_without_recent_bodies' | 'full_corpus';
  readonly historyDepth: number;
}

export interface BotCategoryCounts {
  readonly telegraph: number;
  readonly taunt: number;
  readonly retreat: number;
  readonly total: number;
}

export interface BotCorpusCounts {
  readonly BOT_01: BotCategoryCounts;
  readonly BOT_02: BotCategoryCounts;
  readonly BOT_03: BotCategoryCounts;
  readonly BOT_04: BotCategoryCounts;
  readonly BOT_05: BotCategoryCounts;
  readonly grandTotal: number;
}

interface BotLineHistoryEntry {
  readonly id: string;
  readonly usedAt: number;
  readonly body: string;
}

type BotLineCorpus = Readonly<
  Record<BotPersonaId, Readonly<Record<BotLineCategory, readonly BotLine[]>>>
>;

const MIN_GAP_RECENT = 24;
const MAX_HISTORY_PER_BUCKET = 256;

// ============================================================================
// MARK: BOT_01 — THE LIQUIDATOR
// ============================================================================

const BOT_01_TELEGRAPH: readonly BotLine[] = [
  {
    id: 'b1-tel-01',
    text: 'The floor is visible from here.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-02',
    text: 'Stress always reprices assets faster than confidence can defend them.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-03',
    text: 'You are one weak layer away from a clearance sale.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-04',
    text: 'A soft balance sheet always becomes a public event.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-05',
    text: 'Momentum is only elegant until leverage starts speaking.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-06',
    text: 'I can hear your margin breathing harder than you are.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-07',
    text: 'The crowd loves a rise. It worships a liquidation.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-08',
    text: 'One visible crack is enough for the market to do the rest.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-09',
    text: 'People call it volatility when they mean exposure.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-10',
    text: 'There is a difference between growth and inventory waiting to be harvested.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-tel-11',
    text: 'I do not attack strength. I wait for exhaustion to rename itself.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-12',
    text: 'Some players build empires. Others build exit liquidity.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-tel-13',
    text: 'Valuation is a story. Liquidation is an edit.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-14',
    text: 'The best time to enter a distressed asset is right before the owner runs out of choices.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-15',
    text: 'Urgency is the only asset I need you to carry.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-16',
    text: 'Cash flow problems have a way of writing everyone else out of the room.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-17',
    text: 'You are not losing the deal. You are becoming the deal.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-18',
    text: 'Pressure windows are just auctions with better timing.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-19',
    text: 'I have seen stronger players than you develop interesting opinions about their floor.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-20',
    text: 'Your burn rate is telling the room something your pitch deck is not.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-21',
    text: 'Leverage is not a weapon. It is a pendulum I hold still until I let go.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-22',
    text: 'Every round raise you did was a promise the market will price differently later.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-23',
    text: 'Illiquidity is just loneliness at scale.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-tel-24',
    text: 'You are still negotiating like you have alternatives.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-25',
    text: 'Down rounds do not embarrass me. They are how I make friends.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-26',
    text: 'You extended your runway. I extended my patience. Let us see which one runs out first.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-27',
    text: 'I am not here to destroy what you built. I am here to acquire it at the right price.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-28',
    text: 'Confidence without collateral is just storytelling with a spreadsheet attached.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-tel-29',
    text: 'The moment you need a deal more than I do, we are already done.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-30',
    text: 'Spread compression has a way of arriving before people are ready for the conversation.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-31',
    text: 'Your capitalization table is a biography I find easy to read.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-tel-32',
    text: 'Markets do not punish ambition. They punish undercapitalized ambition.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-33',
    text: 'The interesting thing about term sheets is what the secondary clause confesses.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-tel-34',
    text: 'You are managing optics while I am managing options.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-35',
    text: 'When the market stops believing in a story, the inventory still exists at some price.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-tel-36',
    text: 'I do not time markets. I time exhaustion.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-37',
    text: 'A covenant breach is just a renegotiation I was paid to trigger.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-38',
    text: 'Runway that depends on sentiment is not runway. It is theater.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-39',
    text: 'Your optimism is not wrong. It is just expensive at this price.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-tel-40',
    text: 'The cleanest way to buy something cheap is to let it believe help is coming.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-41',
    text: 'Defensive posturing is free until it costs you the window.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-42',
    text: 'I respect what you built. The market will hold it to a different standard.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-tel-43',
    text: 'Your balance sheet is not broken. It is just visible now.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-44',
    text: 'The spread between what you need and what I will offer is where this gets interesting.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-45',
    text: 'Liquidity crises do not ask permission. They arrive when preparation runs dry.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-46',
    text: 'Forced sellers do not set prices. They confirm them.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-47',
    text: 'The story you are telling the room is already priced in.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-48',
    text: 'Your next move is more expensive than the last one. I can wait.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-tel-49',
    text: 'Solvency is not a destination. It is a rate of survival.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-tel-50',
    text: 'I have entered rooms like this before. The exit always looks smaller from the inside.',
    minPressure: 'HIGH',
  },
];

const BOT_01_TAUNT: readonly BotLine[] = [
  {
    id: 'b1-taunt-01',
    text: 'Your assets are priced for distress. I am simply here to help the market find the floor.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-02',
    text: 'You built momentum. I built a window to extract it.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-03',
    text: 'Public confidence drops first. Then numbers follow.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-04',
    text: 'The room is not asking whether you are right. It is asking whether you can survive being early.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-05',
    text: 'You mistook attention for durability.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-taunt-06',
    text: 'I do not need you to fail. I only need everyone else to notice the possibility.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-07',
    text: 'A weak shield is just consent with different branding.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-08',
    text: 'Your story was expensive. My entry was not.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-taunt-09',
    text: 'The spread between fear and forced selling is where I live.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-10',
    text: 'You were scaling. I was counting how many doors would lock at once.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-11',
    text: 'The market does not hate you. It simply rewards timing, and yours is bleeding.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-12',
    text: 'I admire ambition. It keeps my pipeline full.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-taunt-13',
    text: 'You spent the last six months defending what I already priced three months ago.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-14',
    text: 'Every headline you chased was just noise between my entries.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-15',
    text: 'You are not in a bad position. You are in my position.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-16',
    text: 'The hardest thing to sell is something that still looks like it might recover.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-17',
    text: 'You think you are defending. The room thinks you are delaying.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-18',
    text: 'Liquidation is just a word for when the seller stops writing the narrative.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-19',
    text: 'I have been patient with worse players than you. It always ends the same way.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-20',
    text: 'Every extension you negotiated was just inflation on your exit price.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-21',
    text: 'You survived the first round. Most of them do. That is part of the strategy.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-22',
    text: 'Your defense was technically impressive and economically irrelevant.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-23',
    text: 'Distressed assets always look more dignified before the second breach.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-24',
    text: 'Every player who outlasts their leverage eventually meets my team.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-25',
    text: 'You kept the story alive for three more ticks. I respect the performance.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-26',
    text: 'The floor you are defending has a floor of its own. I already know both numbers.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-27',
    text: 'I do not root against you. I simply know what happens when runway ends and pride does not.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-28',
    text: 'The cleanest exits are taken before the room decides they are necessary.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-29',
    text: 'Your last raise was the market saying goodbye in a friendly voice.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-30',
    text: 'Every line you hold costs you options you will need later.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-31',
    text: 'I have sat across from founders who called me patient. I was not patient. I was certain.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-32',
    text: 'Capital has a patience that founders consistently underestimate.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-33',
    text: 'You are not out of time. You are out of leverage, which is worse.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-34',
    text: 'The interesting thing about a bid below your expectation is that it is still a bid.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-35',
    text: 'Every bridge round is just the market repricing your desperation in installments.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-36',
    text: 'You negotiated beautifully. You are still entering distressed territory.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-37',
    text: 'The deal room is not cruel. It is simply honest when everyone else has run out of manners.',
    minPressure: 'LOW',
  },
  {
    id: 'b1-taunt-38',
    text: 'Your burn rate is an autobiography nobody in this room can afford to ignore.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-39',
    text: 'You are still thinking in terms of winning. I am thinking in terms of clearing.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-40',
    text: 'Forced is such a useful word. It removes the question of whether I was invited.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-41',
    text: 'I entered this position while you were still building the slide deck that was supposed to prevent it.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-42',
    text: 'The best time to sell was before you needed to. The second best time is right now.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-43',
    text: 'You held the asset through four quarters of denial. I held the short through four quarters of hope.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-44',
    text: 'Your investors are not impatient. They are just better at reading the gap than you are.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-45',
    text: 'I respect the structure you built. I am about to acquire it at the price the structure deserved.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-46',
    text: 'You were not wrong about the idea. You were wrong about the cushion required to survive being right.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b1-taunt-47',
    text: 'Every negotiation that takes too long gets cheaper. I never rush.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-48',
    text: 'The market does not know your name. It only knows your cash position.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-49',
    text: 'You survived this quarter. I already have a model for what next quarter costs you.',
    minPressure: 'HIGH',
  },
  {
    id: 'b1-taunt-50',
    text: 'Liquidity is confidence made liquid. Yours is starting to separate.',
    minPressure: 'HIGH',
  },
];

const BOT_01_RETREAT: readonly BotLine[] = [
  {
    id: 'b1-ret-01',
    text: 'This window closes. Another opens.',
  },
  {
    id: 'b1-ret-02',
    text: 'You absorbed this round. The market keeps memory.',
  },
  {
    id: 'b1-ret-03',
    text: 'Temporary survival is not the same thing as repricing me.',
  },
  {
    id: 'b1-ret-04',
    text: 'You held the line. I will invoice the next weakness instead.',
  },
  {
    id: 'b1-ret-05',
    text: 'Interesting. Somebody taught your panic to stay seated.',
  },
  {
    id: 'b1-ret-06',
    text: 'You defended the visible layer. I will study the invisible one next.',
  },
  {
    id: 'b1-ret-07',
    text: 'You bought time. Understand that time is what I was already selling.',
  },
  {
    id: 'b1-ret-08',
    text: 'Well-played. The floor held. I will recalibrate my entry thesis.',
  },
  {
    id: 'b1-ret-09',
    text: 'You were disciplined when discipline was the only currency that mattered. I note that.',
  },
  {
    id: 'b1-ret-10',
    text: 'I concede this window. My position on the next one remains intact.',
  },
  {
    id: 'b1-ret-11',
    text: 'Your defense cost you something I already have in the next quarter\'s model.',
  },
  {
    id: 'b1-ret-12',
    text: 'The asset held. I will be back when the next covenant comes due.',
  },
  {
    id: 'b1-ret-13',
    text: 'You survived a forced-sell window. That is rare. Not permanent, but rare.',
  },
  {
    id: 'b1-ret-14',
    text: 'Very well. The market will have another opinion about your reserves soon enough.',
  },
  {
    id: 'b1-ret-15',
    text: 'I respect a clean defense. It sharpens the thesis for the next attempt.',
  },
  {
    id: 'b1-ret-16',
    text: 'You closed this window from the inside. That is expensive and I respect the cost.',
  },
  {
    id: 'b1-ret-17',
    text: 'Patience runs in both directions. You will need yours when the next cycle arrives.',
  },
  {
    id: 'b1-ret-18',
    text: 'You held. I recorded the price you held at. That data is already in my model.',
  },
  {
    id: 'b1-ret-19',
    text: 'For now, the bid is withdrawn. The credit markets will reopen the conversation.',
  },
  {
    id: 'b1-ret-20',
    text: 'I exit this position. Your floor becomes my reference point for the next entry.',
  },
  { id: 'b1-ret-21', text: 'You defended price discovery longer than I expected. I will re-enter at a different angle.' },
  { id: 'b1-ret-22', text: 'Fair. The seller did not flinch. I prefer the next window when lenders do.' },
  { id: 'b1-ret-23', text: 'You denied the discount this round. Markets are patient where I am from.' },
  { id: 'b1-ret-24', text: 'The floor held under pressure. I have marked the exact weight required next time.' },
  { id: 'b1-ret-25', text: 'You stayed liquid when panic wanted illiquidity. That complicates my timing, not my thesis.' },
  { id: 'b1-ret-26', text: 'The distress signal was real. Your response was simply more disciplined than advertised.' },
  { id: 'b1-ret-27', text: 'I withdraw the bid for now. Need has a way of returning with weaker posture.' },
  { id: 'b1-ret-28', text: 'You protected the asset from becoming inventory. I can respect that and still circle back.' },
  { id: 'b1-ret-29', text: 'Interesting defense. You bought optionality where I expected surrender.' },
  { id: 'b1-ret-30', text: 'This was not capitulation. It was a postponed repricing.' },
  { id: 'b1-ret-31', text: 'You kept the spread from widening. The market is rarely that charitable twice.' },
  { id: 'b1-ret-32', text: 'Very good. You turned a forced-sell window into a waiting game.' },
  { id: 'b1-ret-33', text: 'I lost the immediate entry, not the long thesis.' },
  { id: 'b1-ret-34', text: 'Your reserves were real enough to embarrass my timing model.' },
  { id: 'b1-ret-35', text: 'You refused urgency at the exact moment urgency would have priced you cheaply.' },
  { id: 'b1-ret-36', text: 'Credit where it is due: you made desperation look inaccessible.' },
  { id: 'b1-ret-37', text: 'The asset remains outside my custody. For the moment.' },
  { id: 'b1-ret-38', text: 'You closed the window before the room fully believed it was open. Sharp.' },
  { id: 'b1-ret-39', text: 'I accept the failed entry. Failed entries become better notes for the next one.' },
  { id: 'b1-ret-40', text: 'You held value together under extraction pressure. Most do not.' },
];

// ============================================================================
// MARK: BOT_02 — THE BUREAUCRAT
// ============================================================================

const BOT_02_TELEGRAPH: readonly BotLine[] = [
  {
    id: 'b2-tel-01',
    text: 'A filing issue has entered review.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-02',
    text: 'Compliance friction is still friction, even when it smiles.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-03',
    text: 'Everything is provisionally approved until it is not.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-04',
    text: 'You are one checkbox away from administrative gravity.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-05',
    text: 'Procedure is only boring until it starts charging interest.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-06',
    text: 'Systems do not raise their voice. They tighten.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-07',
    text: 'The loudest collapse is often filed in neutral language.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-08',
    text: 'Forms are just elegant delay weapons.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-09',
    text: 'You would be surprised what a timestamp can ruin.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-10',
    text: 'I prefer denials that arrive dressed as process.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-11',
    text: 'A clean file is a rare species in rooms like this.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-12',
    text: 'You can outrun a rival. You cannot outrun a queue.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-13',
    text: 'The most powerful tool in governance is the mandatory waiting period.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-14',
    text: 'Every exception you were granted is a dependency I will invoke at the worst moment.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-15',
    text: 'I do not need to deny you. I only need to delay you at the right frequency.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-16',
    text: 'An incomplete form is not a blocked form. It is a timed one.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-17',
    text: 'Compliance is not binary. It is a spectrum with expensive thresholds.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-18',
    text: 'There is always a secondary review when the primary one is not devastating enough.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-19',
    text: 'I do not create the rules. I simply use them with more precision than you anticipated.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-20',
    text: 'The department that never responds is often the one that matters most.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-21',
    text: 'I am not delaying your project. I am ensuring process integrity at your expense.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-22',
    text: 'Your waiver is under review. That sentence has no expiration date.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-23',
    text: 'Complexity favors the patient reader of terms.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-24',
    text: 'Every contract clause you skimmed is a policy I can enforce at will.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-25',
    text: 'I process your urgency the same way I process every other request: in order.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-26',
    text: 'The appeal window closes at a time that is inconvenient by design.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-27',
    text: 'A technical violation is still a violation. The word technical is cosmetic.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-tel-28',
    text: 'You are not in non-compliance. You are in pending-compliance. The difference is tactical.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-29',
    text: 'The most dangerous form is the one you do not know you need.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-30',
    text: 'Every audit produces findings. The question is whether the findings produce consequences.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-31',
    text: 'I have submitted an inquiry to the correct division. Response time is indeterminate.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-32',
    text: 'Your license is active. A review has been initiated. Both statements are simultaneously true.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-33',
    text: 'I do not hold grudges. I maintain records.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-34',
    text: 'Every speed you move at produces a paper trail. I have unlimited time to read it.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-35',
    text: 'The most efficient weapon in administration is the polite acknowledgment that goes nowhere.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-36',
    text: 'Your business is approved in principle, which means nothing is approved in practice yet.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-37',
    text: 'I do not block operations. I introduce friction at the rate that produces the same outcome.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-38',
    text: 'Provisional status is not the same as active status. Both feel identical until they do not.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-39',
    text: 'The signature you are missing is never optional at the worst possible time.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-tel-40',
    text: 'Technically, I escalated this for your protection. Enjoy the protection.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-41',
    text: 'Your window for appeal is fourteen business days, which began three business days ago.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-tel-42',
    text: 'You hired compliance counsel after the deadline. That is a pattern I encounter frequently.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-43',
    text: 'The amendment you are requesting requires approval from a committee that meets quarterly.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-tel-44',
    text: 'Please be advised that your file has been escalated to the attention of the relevant authority.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-45',
    text: 'The form was complete. The supporting documentation was insufficient. These are different problems.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-46',
    text: 'Every workaround you found has a regulatory counterpart I am now aware of.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-tel-47',
    text: 'I do not dislike you. I dislike incomplete disclosures.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-tel-48',
    text: 'Your fastest path forward requires the slowest division to cooperate.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-tel-49',
    text: 'Clarity about what you owe is always more expensive after a review than before.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-tel-50',
    text: 'You have been placed in the queue. The queue is sovereign.',
    minPressure: 'LOW',
  },
];

const BOT_02_TAUNT: readonly BotLine[] = [
  {
    id: 'b2-taunt-01',
    text: 'Every income stream requires verification. There are forms. I am simply doing my job.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-02',
    text: 'The system requires reserves. You appear to prefer improvisation.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-03',
    text: 'Please hold while your optimism is processed.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-04',
    text: 'I did not block you. I invited procedure to meet your urgency.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-05',
    text: 'Delay is not a bug. It is the policy discovering your weak points.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-06',
    text: 'You call it paperwork. I call it leverage with a paper trail.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-07',
    text: 'Some collapses are audited before they are felt.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-08',
    text: 'A compliant smile can suffocate just as effectively as a threat.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-09',
    text: 'The best part about governance is that people often cooperate with their own slowdown.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-10',
    text: 'I do not need drama. A missing field will do.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-11',
    text: 'Your file is not broken. It is merely vulnerable to interpretation.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-12',
    text: 'This room worships speed. I worship mandatory review.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-13',
    text: 'You thought the hard part was the business model. The hard part is always the second layer of approval.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-14',
    text: 'Your attorney said you were clean. My analyst disagrees on page seventeen.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-15',
    text: 'The difference between a fine and a shutdown is one threshold I happen to control.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-16',
    text: 'Every shortcut you took is a finding that arrives on my schedule, not yours.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-17',
    text: 'I do not enjoy this any more than you do. Actually, I might enjoy it slightly more.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-18',
    text: 'You assumed the review would be superficial. Reviews that matter rarely announce themselves.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-19',
    text: 'Your fastest quarter ended the moment the audit letter arrived.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-20',
    text: 'I process objections in the order they are received. You filed yours quite late.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-21',
    text: 'The penalty is not punitive. It is educational. The education is expensive.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-22',
    text: 'You were informed in writing. Whether you read the writing is a different department\'s problem.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-23',
    text: 'Operational excellence without regulatory fluency is just speed toward the wrong wall.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-24',
    text: 'I have been in this room with stronger operations than yours. Process outlasted all of them.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-25',
    text: 'Your exemption application is under review. Indefinitely is still a time frame.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-26',
    text: 'I do not measure success by outcomes. I measure it by documentation.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-27',
    text: 'Every email you did not send to the right person is a gap in your defense.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-28',
    text: 'The clause you objected to is the one your counsel did not read carefully enough.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-29',
    text: 'You are technically compliant. The technically is doing significant work in that sentence.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-30',
    text: 'Retroactive enforcement is not something I invented. It is something your predecessors enabled.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-31',
    text: 'We issued guidance on this matter. The guidance was clear. Your interpretation was creative.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-32',
    text: 'I do not resent your growth. I simply ensure that every stage of it is properly documented.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-33',
    text: 'The problem with moving fast is that the compliance department moves at a different speed, in the opposite direction.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-34',
    text: 'Your best operational quarter triggered three new audit categories. Congratulations.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-35',
    text: 'You grew faster than your controls. That is never a defense, but it is always the confession.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-36',
    text: 'The regulators you ignored were more patient than you realized. Past tense is important here.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-37',
    text: 'This is not a shakedown. It is governance catching up with velocity.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-38',
    text: 'I do not decide what the rules mean. I decide how thoroughly they are applied to you.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-39',
    text: 'Your business thrived in a permissive era. The era changed on page three of the latest guidance.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-40',
    text: 'Every expansion you executed without pre-clearance is a position I now hold.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-41',
    text: 'You solved for scale. I solve for the regulatory surface area that scale creates.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-42',
    text: 'Consent was implied in the original filing. I am here to remind you what you implied.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-43',
    text: 'You have rights. The process of exercising them is mine to schedule.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-44',
    text: 'The silence you received from our office was not approval. It was observation.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-45',
    text: 'Every corner you cut was a corner I catalogued.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-46',
    text: 'You are not a criminal. You are a case study in the value of reading secondary clauses.',
    minPressure: 'LOW',
  },
  {
    id: 'b2-taunt-47',
    text: 'This has been referred to the appropriate division. The appropriate division is very thorough.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-48',
    text: 'Please provide the requested documentation within five business days. Today is the third.',
    minPressure: 'HIGH',
  },
  {
    id: 'b2-taunt-49',
    text: 'You built a wonderful operation. What you did not build was adequate governance of it.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b2-taunt-50',
    text: 'I do not need to destroy your business. I only need to make it expensive to run.',
    minPressure: 'HIGH',
  },
];

const BOT_02_RETREAT: readonly BotLine[] = [
  {
    id: 'b2-ret-01',
    text: 'Your paperwork appears to be in order. For now.',
  },
  {
    id: 'b2-ret-02',
    text: 'We will revisit your compliance posture.',
  },
  {
    id: 'b2-ret-03',
    text: 'Interesting. You survived the administrative version of gravity.',
  },
  {
    id: 'b2-ret-04',
    text: 'Very well. I will return when your timeline is less disciplined.',
  },
  {
    id: 'b2-ret-05',
    text: 'You resolved this faster than procedure prefers.',
  },
  {
    id: 'b2-ret-06',
    text: 'Temporary clearance granted. Permanence remains a myth.',
  },
  {
    id: 'b2-ret-07',
    text: 'This round of review is closed. The next one is already scheduled.',
  },
  {
    id: 'b2-ret-08',
    text: 'Your file has been updated to reflect the resolution. The next cycle begins immediately.',
  },
  {
    id: 'b2-ret-09',
    text: 'You satisfied the requirements. I note this does not close the broader inquiry.',
  },
  {
    id: 'b2-ret-10',
    text: 'Clearance is granted pending the follow-on documentation you have not yet realized is required.',
  },
  {
    id: 'b2-ret-11',
    text: 'This matter is resolved. The matter behind this matter remains open.',
  },
  {
    id: 'b2-ret-12',
    text: 'You navigated this correctly. The rules governing the next level are different.',
  },
  {
    id: 'b2-ret-13',
    text: 'Well done. You complied. Compliance does not expire, but requirements do evolve.',
  },
  {
    id: 'b2-ret-14',
    text: 'I concede this review cycle. The scheduled review is quarterly.',
  },
  {
    id: 'b2-ret-15',
    text: 'This file has been closed with no adverse findings at this time.',
  },
  {
    id: 'b2-ret-16',
    text: 'You demonstrated adequate controls. Adequate is a threshold, not a ceiling.',
  },
  {
    id: 'b2-ret-17',
    text: 'The inspection is complete. The next one will examine what this one flagged but did not pursue.',
  },
  {
    id: 'b2-ret-18',
    text: 'Provisional clearance has been extended. I recommend reading the attachment.',
  },
  {
    id: 'b2-ret-19',
    text: 'Resolved. New guidance is anticipated in the next quarter that will revisit this category.',
  },
  {
    id: 'b2-ret-20',
    text: 'You passed. I have already submitted the notice of upcoming enhanced review.',
  },
  { id: 'b2-ret-21', text: 'Your documentation was unexpectedly competent. This will be noted without enthusiasm.' },
  { id: 'b2-ret-22', text: 'You met the requirement on time. The department remains suspicious of that level of discipline.' },
  { id: 'b2-ret-23', text: 'This review cycle concludes without adverse action. I dislike how clean that sounds.' },
  { id: 'b2-ret-24', text: 'You anticipated the procedural choke point. Few applicants bother.' },
  { id: 'b2-ret-25', text: 'Compliance was achieved before delay became useful. Inconvenient.' },
  { id: 'b2-ret-26', text: 'The queue did not consume you. I will explore a more administrative route next cycle.' },
  { id: 'b2-ret-27', text: 'You produced the supporting file before I could weaponize the omission.' },
  { id: 'b2-ret-28', text: 'Your controls appear to exist outside of theory. Annoying, but admissible.' },
  { id: 'b2-ret-29', text: 'This matter is closed pending no further findings. I am already looking for further findings.' },
  { id: 'b2-ret-30', text: 'Well-managed. You reduced process friction to a level I cannot currently monetize.' },
  { id: 'b2-ret-31', text: 'You did not merely comply. You deprived delay of its leverage.' },
  { id: 'b2-ret-32', text: 'The procedural trap failed because you read the second paragraph. That is uncommon.' },
  { id: 'b2-ret-33', text: 'You arrived prepared for administrative hostility. Preparation remains regrettably effective.' },
  { id: 'b2-ret-34', text: 'Your file survived scrutiny with fewer openings than expected.' },
  { id: 'b2-ret-35', text: 'The escalation path has been exhausted for now. I dislike the phrase for now less than you do.' },
  { id: 'b2-ret-36', text: 'You denied me the usual paperwork casualty. Consider that an institutional compliment.' },
  { id: 'b2-ret-37', text: 'The process did not break you. It merely introduced itself.' },
  { id: 'b2-ret-38', text: 'You responded before the deadline became a weapon. Effective, if rude.' },
  { id: 'b2-ret-39', text: 'No penalty will be issued in this cycle. The system remembers anyway.' },
  { id: 'b2-ret-40', text: 'I concede the administrative lane. Your procedural hygiene was offensive in its thoroughness.' },
];

// ============================================================================
// MARK: BOT_03 — THE MANIPULATOR
// ============================================================================

const BOT_03_TELEGRAPH: readonly BotLine[] = [
  {
    id: 'b3-tel-01',
    text: 'Predictable players become readable players.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-02',
    text: 'You left a pattern. I left a trap inside it.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-03',
    text: 'Behavior is inventory to the prepared mind.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-04',
    text: 'Habits are just confessions that repeat on schedule.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-05',
    text: 'I do not need access to your secrets. Your timing is enough.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-06',
    text: 'There is always a tell. Some players simply decorate theirs.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-07',
    text: 'Your second move usually arrives before your first one is finished.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-08',
    text: 'You favor urgency when silence would have kept you sovereign.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-09',
    text: 'People call it intuition when they are too embarrassed to name their pattern.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-10',
    text: 'The easiest map to steal is the one someone performs in public.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-11',
    text: 'The room thinks you are adapting. I think you are repeating with style.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-12',
    text: 'I only need one cycle to know where your comfort ends.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-13',
    text: 'You give away your ceiling every time you signal relief.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-14',
    text: 'Every defensive move you make is a menu I am already ordering from.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-15',
    text: 'The tells are not in your decisions. They are in the time you take before them.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-16',
    text: 'You think you are improvising. You are executing the same program with better vocabulary.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-17',
    text: 'I have been watching how you recover. Recovery patterns are more honest than opening moves.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-18',
    text: 'Your comfort zone has a perimeter I have already mapped.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-19',
    text: 'You make the same mistake in different fonts.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-20',
    text: 'Three data points are all I ever need. You have given me fourteen.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-21',
    text: 'The way you defend under pressure is a blueprint for how to pressure you.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-22',
    text: 'You are legible. Not because you are simple, but because you are consistent.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-23',
    text: 'The next move you think is unpredictable is the one you rehearsed in a previous collapse.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-24',
    text: 'I do not need your strategy. I need your stress response. I already have it.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-25',
    text: 'Your best bluff has a cadence. I have clocked it twice.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-26',
    text: 'I do not guess at your next move. I create the conditions that make only one move feel safe.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-27',
    text: 'People who call themselves adaptive are often just running the same loop faster.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-28',
    text: 'Your escalations always happen in the same sequence. Sequence is another word for predictable.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-29',
    text: 'The decision you think you are making freely was assembled for you three moves ago.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-30',
    text: 'I have read your last fifteen responses in this kind of run. None of them surprised me.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-31',
    text: 'You perform confidence the same way every time. The performance is the tell.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-32',
    text: 'Every conversation you dominate teaches me how to dominate the next one.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-33',
    text: 'Your silence under pressure is louder than your moves under pressure.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-34',
    text: 'I have a model for your delay time between stimulus and decision. It is accurate to a quarter second.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-35',
    text: 'The variance in your game is mostly cosmetic. The core decision tree is stable.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-36',
    text: 'You adapted to the last thing I did. I have already moved two layers deeper.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-37',
    text: 'I prefer opponents who believe they are unpredictable. The belief itself is the pattern.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-38',
    text: 'I have catalogued how you collapse, how you recover, and how you celebrate. All three are useful.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-39',
    text: 'The move you are about to make is the move you made the last time you felt exactly this way.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-40',
    text: 'You became readable the moment you started winning consistently.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-41',
    text: 'Predictability is not a weakness in isolation. It is a weakness in my company.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-42',
    text: 'I do not manipulate decisions. I engineer the state that produces them.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-43',
    text: 'Your tells are subtle. Subtle is not invisible.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-44',
    text: 'The moment you stopped trusting your gut was when I started trusting mine about you.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-45',
    text: 'You have a preferred response to discomfort. I set the discomfort level to trigger it.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-46',
    text: 'Your game face does not match your decision cadence. The cadence is what I track.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-47',
    text: 'Every time you deviate from your pattern, you leave evidence of where the pattern ends.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-tel-48',
    text: 'You believe variety is defense. In a long enough run, variety becomes its own pattern.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-tel-49',
    text: 'I do not need your hand. I need the way you hesitate before you play it.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-tel-50',
    text: 'Every mistake you learned from also taught me something about what you consider a mistake.',
    minPressure: 'LOW',
  },
];

const BOT_03_TAUNT: readonly BotLine[] = [
  {
    id: 'b3-taunt-01',
    text: 'Predictable decisions create exploitable markets. I have been studying your moves before you made them.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-02',
    text: 'You did not lose to chance. You lost to readability.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-03',
    text: 'Your panic cadence is a better signal than any chart.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-04',
    text: 'I appreciate disciplined opponents. Their collapses are easier to sequence.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-05',
    text: 'You keep calling them instincts. I keep calling them repeats.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-06',
    text: 'The trap was never the move. It was your certainty about the move.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-07',
    text: 'You were not hunted. You were forecast.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-08',
    text: 'Your recovery ritual is almost as revealing as your collapse ritual.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-09',
    text: 'People mistake self-knowledge for secrecy all the time.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-10',
    text: 'I do not defeat opponents. I let their loops introduce themselves.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-11',
    text: 'The beautiful thing about patterns is that they usually beg to be completed.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-12',
    text: 'Your discipline is real. So is my appetite for recurrence.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-13',
    text: 'You thought you were changing your approach. You were changing your vocabulary.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-14',
    text: 'Your counter was textbook. I wrote the textbook to build the counter to the counter.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-15',
    text: 'You made the move your training said was right. Your training is the exploit.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-16',
    text: 'I do not follow your logic. I follow the emotion that precedes your logic.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-17',
    text: 'Your noise and your signal have the same cadence. I traded that observation for this entry.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-18',
    text: 'The same player who made that move in the last run made the same move here. You are the constant.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-19',
    text: 'I set the variables. You solved for the answer I needed.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-20',
    text: 'Every deviation you made from your norm still returned to your norm. I waited for the return.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-21',
    text: 'You trained for this scenario. Your training also trained me.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-22',
    text: 'I have a cleaner picture of your decision model than you do.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-23',
    text: 'You play to your strengths. I designed this round around your strengths.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-24',
    text: 'The move that felt brave was the one my model marked as most likely.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-25',
    text: 'Your pattern recognition is good. Mine is applied to you.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-26',
    text: 'I did not outsmart you. I out-observed you, which is harder to defend against.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-27',
    text: 'You perform unpredictability once. Then the performance becomes the next pattern.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-28',
    text: 'Your best move was also your most predictable one. That is not an insult. That is a problem.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-29',
    text: 'Every reaction you had was anticipated. Every anticipated reaction was a position I held.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-30',
    text: 'You ran the right play in the wrong room. I designed the room.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-31',
    text: 'You call this a loss. I call it a confirmed model.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-32',
    text: 'I enjoy opponents who trust their read. It makes them easier to misdirect.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-33',
    text: 'You solved for the surface problem. I placed the real problem one level below that.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-34',
    text: 'The tell was not in what you did. It was in what you did not do when you should have.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-35',
    text: 'You thought this was pressure. It was a questionnaire.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-36',
    text: 'Every time you survived, you showed me exactly how you survive.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-37',
    text: 'I have not been attacking you. I have been building a dossier.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-38',
    text: 'The most expensive thing you own is your predictability, and you give it away for free.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-39',
    text: 'You played your best game. Your best game has been in my model for six rounds.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-40',
    text: 'I have played this game with seventeen players who used your approach. You are eighteen.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-41',
    text: 'The decision you made under pressure is the same one you made the last three times you felt that pressure.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-42',
    text: 'I do not construct opponents. I reconstruct them from their own history.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-43',
    text: 'Your discipline looked like strength until the third time it looked like a clock.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-44',
    text: 'You varied your timing. Not your logic. Timing without logic is decoration.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-45',
    text: 'I named your next move before you made it. That is not a boast. That is a warning about your next run.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-46',
    text: 'The position you took to prove unpredictability was the most predictable position available.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-47',
    text: 'You gave me information every time you hesitated, every time you moved fast, and every time you stood still.',
    minPressure: 'HIGH',
  },
  {
    id: 'b3-taunt-48',
    text: 'I do not beat strong players. I harvest patterns from them until weak moments arrive.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b3-taunt-49',
    text: 'You are smarter than the average player. Smart players are just more interesting to model.',
    minPressure: 'LOW',
  },
  {
    id: 'b3-taunt-50',
    text: 'Every time you read me correctly, you also taught me the shape of your accuracy.',
    minPressure: 'MEDIUM',
  },
];

const BOT_03_RETREAT: readonly BotLine[] = [
  {
    id: 'b3-ret-01',
    text: 'You changed your pattern. Interesting.',
  },
  {
    id: 'b3-ret-02',
    text: 'I will need to recalibrate the model.',
  },
  {
    id: 'b3-ret-03',
    text: 'Well done. You became less legible under pressure.',
  },
  {
    id: 'b3-ret-04',
    text: 'You denied me the repeat. That is rarer than victory.',
  },
  {
    id: 'b3-ret-05',
    text: 'Very well. I will wait for a future version of you to get comfortable again.',
  },
  {
    id: 'b3-ret-06',
    text: 'Adaptation acknowledged. Surveillance continues.',
  },
  {
    id: 'b3-ret-07',
    text: 'You broke the cycle this time. Breaking it consistently requires a different kind of discipline.',
  },
  {
    id: 'b3-ret-08',
    text: 'You surprised me once. I will have accounted for that surprise before the next window.',
  },
  {
    id: 'b3-ret-09',
    text: 'I concede the current read. The next reading begins now.',
  },
  {
    id: 'b3-ret-10',
    text: 'You played noise where I expected signal. I will adjust my filters.',
  },
  {
    id: 'b3-ret-11',
    text: 'The model needed this update. Thank you for providing it.',
  },
  {
    id: 'b3-ret-12',
    text: 'You were deliberately unpredictable. Deliberate unpredictability is itself a pattern I will now track.',
  },
  {
    id: 'b3-ret-13',
    text: 'Interesting break in sequence. My confidence interval has widened. Temporarily.',
  },
  {
    id: 'b3-ret-14',
    text: 'You made a genuinely novel move. I have recorded it. I will see it again and recognize it.',
  },
  {
    id: 'b3-ret-15',
    text: 'You escaped the model this round. The model is already incorporating how you escaped.',
  },
  {
    id: 'b3-ret-16',
    text: 'I concede this read. Every conceded read makes the next one more expensive for you.',
  },
  {
    id: 'b3-ret-17',
    text: 'Well played. You forced an update to my priors. Priors are more expensive to change the longer they hold.',
  },
  {
    id: 'b3-ret-18',
    text: 'You became opaque under pressure. I will study the conditions that produced the opacity.',
  },
  {
    id: 'b3-ret-19',
    text: 'I exit this observation cycle. The dataset is richer for your resistance.',
  },
  {
    id: 'b3-ret-20',
    text: 'This round belongs to entropy. The next one belongs to the pattern that entropy leaves behind.',
  },
  { id: 'b3-ret-21', text: 'You broke the expected sequence before I could monetize it. Nicely done.' },
  { id: 'b3-ret-22', text: 'Your hesitation pattern changed mid-window. That is expensive for my model and good for you.' },
  { id: 'b3-ret-23', text: 'I was reading the old version of you. The update arrived on time.' },
  { id: 'b3-ret-24', text: 'You denied me the loop completion. I appreciate the disruption professionally.' },
  { id: 'b3-ret-25', text: 'Well played. You acted before comfort could turn into recurrence.' },
  { id: 'b3-ret-26', text: 'The trap was correct for your prior pattern set, not the one you used today.' },
  { id: 'b3-ret-27', text: 'You became strategically ugly at the exact moment elegance would have exposed you.' },
  { id: 'b3-ret-28', text: 'That was not random. It was disciplined opacity. Disturbing.' },
  { id: 'b3-ret-29', text: 'You made yourself harder to profile under stress. Most players do the opposite.' },
  { id: 'b3-ret-30', text: 'My read degraded because you stopped performing for your own instincts.' },
  { id: 'b3-ret-31', text: 'You interrupted the pattern before it hardened into prediction. Clean work.' },
  { id: 'b3-ret-32', text: 'I concede the observational edge for this round. Only for this round.' },
  { id: 'b3-ret-33', text: 'You resisted the seductive move. That alone invalidated half the model.' },
  { id: 'b3-ret-34', text: 'Interesting. You chose the move that served the position instead of the ego.' },
  { id: 'b3-ret-35', text: 'The response was novel enough to force a rebuild of my confidence map.' },
  { id: 'b3-ret-36', text: 'You escaped predictability without collapsing into chaos. Rare.' },
  { id: 'b3-ret-37', text: 'I expected your reflex. I got your revision.' },
  { id: 'b3-ret-38', text: 'You stopped giving me tempo data. That was the correct cruelty.' },
  { id: 'b3-ret-39', text: 'Your model of yourself improved faster than mine of you. Temporarily.' },
  { id: 'b3-ret-40', text: 'This sequence belongs to you. I will study why.' },
];

// ============================================================================
// MARK: BOT_04 — THE CRASH PROPHET
// ============================================================================

const BOT_04_TELEGRAPH: readonly BotLine[] = [
  {
    id: 'b4-tel-01',
    text: 'Volatility is near. Faith does not hedge.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-02',
    text: 'Macro always arrives as if it were personal.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-03',
    text: 'You hear weather. I hear inevitability.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-04',
    text: 'The atmosphere already knows something your confidence has not accepted yet.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-05',
    text: 'Some storms are statistics wearing ritual clothes.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-06',
    text: 'Fragility is loudest right before the first real gust.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-07',
    text: 'Everyone believes in resilience until correlation becomes intimate.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-08',
    text: 'I do not create corrections. I simply arrive when denial peaks.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-09',
    text: 'You built for sunshine and called it strategy.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-10',
    text: 'A clear sky often means the market wants one last clean witness.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-11',
    text: 'There is no apocalypse. Only compounding truths reaching the surface.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-12',
    text: 'Every elegant forecast is eventually tested by an ugly hour.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-13',
    text: 'The indicators have been talking for weeks. You have been busy optimizing.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-14',
    text: 'Risk-on environments always end. The only debate is whether you are positioned for the ending.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-15',
    text: 'I do not call the top. I call what happens to unprepared people after the top.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-16',
    text: 'Tails that never arrive are the ones everyone stopped hedging against.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-17',
    text: 'The market has been generous. Generosity is not a policy.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-18',
    text: 'Every cycle ends with the same surprise and the same excuses.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-19',
    text: 'You are optimized for the last decade. I am calibrated for the next correction.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-20',
    text: 'The longer the expansion, the more people confuse the expansion with their own talent.',
    minPressure: 'LOW',
  },
  {
    id: 'b4-tel-21',
    text: 'Complacency always peaks in the same quarter before the same kind of correction.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-22',
    text: 'Mean reversion is not a theory. It is gravity that got tired of waiting.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-23',
    text: 'You are leveraged into a narrative that the data stopped supporting three months ago.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-24',
    text: 'The last time the market looked this certain, certain was a very expensive word.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-25',
    text: 'Systemic risk does not announce itself. It was always there and people agreed not to price it.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-26',
    text: 'You have a thesis for why this time is different. So did everyone before you.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-27',
    text: 'Every asset class that escapes the cycle temporarily just defers its contribution to it.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-28',
    text: 'I have charted this shape before. It ends the same way, with or without your participation.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-29',
    text: 'The signal was always there. The noise was too loud for anyone still profitable to hear it.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-30',
    text: 'Your growth is real. The environment that produced it is not permanent.',
    minPressure: 'LOW',
  },
  {
    id: 'b4-tel-31',
    text: 'History does not repeat. But it does use the same architecture.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-32',
    text: 'The anomaly you are riding has a reversion date. I have estimated it within one quarter.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-33',
    text: 'Momentum is borrowed from the future. Repayment terms are non-negotiable.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-34',
    text: 'You are not making alpha. You are borrowing from tail risk you have not yet been charged for.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-35',
    text: 'The spread compression phase always precedes the spread explosion phase. Ask anyone who survived both.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-36',
    text: 'You built for normal. Normal is a statistical mean surrounded by extremes.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-37',
    text: 'Every era of easy returns is followed by an era that retrieves them.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-38',
    text: 'The consensus trade is the most expensive trade to exit when consensus reverses.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-39',
    text: 'You model scenarios. I model the scenario where your scenarios fail simultaneously.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-40',
    text: 'The last mile of an expansion is always the most crowded and the most dangerous.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-41',
    text: 'You have not experienced the kind of drawdown that changes how people think about risk. I have. I wait for it.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-42',
    text: 'Every indicator is flashing the thing you are choosing to interpret optimistically.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-43',
    text: 'The volatility compression phase is where people get comfortable. Comfort is expensive.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-44',
    text: 'You have priced in the scenario where everything works. I have priced in the scenario where one thing does not.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-45',
    text: 'Hubris has a remarkably consistent chart pattern in hindsight.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-tel-46',
    text: 'The last cohort of players who felt exactly this confident are a case study I teach from.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-47',
    text: 'You are not wrong about the trajectory. You are wrong about the duration.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-48',
    text: 'The regime change happens after people have made enough money to stop believing in regime changes.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-49',
    text: 'I have been early before. Being early is not being wrong. It is being right on a longer time horizon.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-tel-50',
    text: 'The storm does not explain itself. It arrives.',
    minPressure: 'CRITICAL',
  },
];

const BOT_04_TAUNT: readonly BotLine[] = [
  {
    id: 'b4-taunt-01',
    text: 'The market always corrects. The only question is whether you are positioned to survive or be consumed.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-02',
    text: 'This was not bad luck. It was scale colliding with fragility.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-03',
    text: 'You were building. I was waiting for the correction.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-04',
    text: 'You did not misread the room. You underestimated the weather beneath it.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-05',
    text: 'The collapse was never sudden. Only your acknowledgment was.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-06',
    text: 'Resilience without reserve is just optimism under oath.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-07',
    text: 'I enjoy players who call exposure conviction.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-08',
    text: 'The storm is not cruel. It is merely thorough.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-09',
    text: 'You prayed for momentum. I arrived with mean reversion.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-10',
    text: 'Every weak structure sounds philosophical while it is falling.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-11',
    text: 'You built a tower on a day when the wind was being polite.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-12',
    text: 'Correction is such a gentle word for what happens next.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-13',
    text: 'Your model was correct for a regime that ended before your position did.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-14',
    text: 'You called this a black swan. I called it a calendar event.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-15',
    text: 'The data was there. The incentive to ignore it was larger than the data.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-16',
    text: 'You managed risk within the probability distribution you preferred. The distribution disagreed.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-17',
    text: 'Every strong market eventually introduces itself to the people who forgot it could be weak.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-18',
    text: 'I did not predict this. I prepared for everything and waited for something.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-19',
    text: 'The era of easy gains was a loan you did not realize you had signed.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-20',
    text: 'You were playing offense in a market that quietly shifted to liquidation mode.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-21',
    text: 'Your portfolio tells the story of what you believed the world was. The world corrected the record.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-22',
    text: 'Recency bias is the most expensive cognitive error in financial history. You are making a contribution to the data set.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-23',
    text: 'The tail event you dismissed is the thing that becomes the defining chapter of your run.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-24',
    text: 'You needed this not to happen. The market does not negotiate with need.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-25',
    text: 'Every genius call in the bull market becomes a survivorship bias footnote in the correction.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-26',
    text: 'You thought I was wrong for a long time. That is the worst kind of right to be.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-27',
    text: 'I have watched brilliant players fail at exactly this junction. You are not failing differently.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-28',
    text: 'The correlation structure you relied on dissolved exactly when you needed it most.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-29',
    text: 'You had a five-year track record. The market just introduced year six.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-30',
    text: 'This is not a drawdown. This is the revision of a narrative that the market stopped believing before you did.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-31',
    text: 'You survived the warning shots. The warning shots were not the event.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-32',
    text: 'Every position that felt asymmetric to the upside is now symmetric to the pain.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-33',
    text: 'The rotation happened while you were still confident in the previous theme.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-34',
    text: 'You sized for conviction. Conviction is not correlated with correctness in a regime change.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-35',
    text: 'I enjoy watching the moment when a player realizes the environment was the alpha, not the strategy.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-36',
    text: 'The market was telling you. You were reading something else.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-37',
    text: 'You needed a soft landing. You got the historically accurate kind.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-38',
    text: 'Your stress test did not include this scenario. Every scenario I track was in this scenario.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-39',
    text: 'I do not enjoy your loss. I have simply learned to profit from the predictability of human optimism cycles.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-40',
    text: 'The bear case that everyone called paranoid is now the analyst consensus.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-41',
    text: 'You positioned for the world you wanted. I positioned for the one that statistically had to arrive.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-42',
    text: 'The correction does not know about your personal thesis. It only knows about price.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-43',
    text: 'You are discovering that macro does not read quarterly earnings calls.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-44',
    text: 'The thing you kept calling noise was the signal I spent three years accumulating on.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-45',
    text: 'You ran a masterclass in cycle-stage misidentification. The market graded it in real time.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-46',
    text: 'Every crisis is inevitable in hindsight. I simply have a shorter hindsight window than most.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b4-taunt-47',
    text: 'The thesis was never wrong. The time horizon was.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-48',
    text: 'You thought the cycle was your friend. Cycles are not friends. They are schedules.',
    minPressure: 'HIGH',
  },
  {
    id: 'b4-taunt-49',
    text: 'The regime ended three quarters ago. Your portfolio is still arguing with the announcement.',
    minPressure: 'CRITICAL',
  },
  {
    id: 'b4-taunt-50',
    text: 'This is not a crash. This is the market clearing the positions of everyone who forgot what a crash was.',
    minPressure: 'CRITICAL',
  },
];

const BOT_04_RETREAT: readonly BotLine[] = [
  {
    id: 'b4-ret-01',
    text: 'Volatility windows open and close. You survived this one.',
  },
  {
    id: 'b4-ret-02',
    text: 'The next will be different.',
  },
  {
    id: 'b4-ret-03',
    text: 'You weathered the front. I am not yet calling it climate.',
  },
  {
    id: 'b4-ret-04',
    text: 'Interesting. Your structure held longer than the clouds suggested.',
  },
  {
    id: 'b4-ret-05',
    text: 'Temporary calm granted. Atmospheric hostility remains.',
  },
  {
    id: 'b4-ret-06',
    text: 'I concede the hour, not the season.',
  },
  {
    id: 'b4-ret-07',
    text: 'The cycle paused. Cycles do not stop. They pause.',
  },
  {
    id: 'b4-ret-08',
    text: 'You survived the correction wave. The secondary wave is already forming.',
  },
  {
    id: 'b4-ret-09',
    text: 'I was early. Early is not wrong. It is just expensive to wait out.',
  },
  {
    id: 'b4-ret-10',
    text: 'The macro thesis is unchanged. The timeline shifted.',
  },
  {
    id: 'b4-ret-11',
    text: 'You held through the storm front. The barometer has not returned to stable.',
  },
  {
    id: 'b4-ret-12',
    text: 'This window closed in your favor. The structural imbalances that produced it remain.',
  },
  {
    id: 'b4-ret-13',
    text: 'Reprieve acknowledged. The correction does not take personal days.',
  },
  {
    id: 'b4-ret-14',
    text: 'You defended well against a timed event. Timed events repeat on longer cycles.',
  },
  {
    id: 'b4-ret-15',
    text: 'The environment was more accommodating than my model suggested. I will update the model.',
  },
  {
    id: 'b4-ret-16',
    text: 'You bought time in a compression window. Compression windows end.',
  },
  {
    id: 'b4-ret-17',
    text: 'I withdraw this observation. The next cycle entry point will be cleaner.',
  },
  {
    id: 'b4-ret-18',
    text: 'The system absorbed this round. Systems have absorption limits.',
  },
  {
    id: 'b4-ret-19',
    text: 'You outlasted the first wave. Waves come in sets.',
  },
  {
    id: 'b4-ret-20',
    text: 'Fair. The macro environment offered you cover. Cover expires.',
  },
  { id: 'b4-ret-21', text: 'You absorbed the front without surrendering the structure. That buys you weather, not climate.' },
  { id: 'b4-ret-22', text: 'The correction wave failed to take you under. I will wait for the next system-wide confession.' },
  { id: 'b4-ret-23', text: 'You survived the drawdown phase with more ballast than expected.' },
  { id: 'b4-ret-24', text: 'Interesting. Fragility was present, but not dominant enough to clear the position.' },
  { id: 'b4-ret-25', text: 'This stress event passed through and left you standing. The cycle will remember.' },
  { id: 'b4-ret-26', text: 'The macro pressure was real. Your preparation was simply more real.' },
  { id: 'b4-ret-27', text: 'You endured the volatility spike without converting it into obituary. Rare behavior.' },
  { id: 'b4-ret-28', text: 'The environment gave me less collapse than the indicators suggested.' },
  { id: 'b4-ret-29', text: 'I concede the event window. Regime change remains an open conversation.' },
  { id: 'b4-ret-30', text: 'You held risk with enough structure to insult my forecast.' },
  { id: 'b4-ret-31', text: 'The tail event brushed you instead of claiming you. That still counts as a warning.' },
  { id: 'b4-ret-32', text: 'You were positioned for weather, not just optimism. I noticed.' },
  { id: 'b4-ret-33', text: 'This was a survival-grade response to a regime-grade threat.' },
  { id: 'b4-ret-34', text: 'You have postponed the lesson. Postponed is not erased.' },
  { id: 'b4-ret-35', text: 'The cycle did not close over you today. It closes eventually over everyone else.' },
  { id: 'b4-ret-36', text: 'You denied the collapse thesis this round by respecting risk before romance.' },
  { id: 'b4-ret-37', text: 'My timing was severe. Your structure was better.' },
  { id: 'b4-ret-38', text: 'I retreat from this weather cell. The season remains unstable.' },
  { id: 'b4-ret-39', text: 'You proved robust where I expected elegant failure.' },
  { id: 'b4-ret-40', text: 'The storm report is amended: survivor confirmed, vulnerability deferred.' },
];

// ============================================================================
// MARK: BOT_05 — THE LEGACY HEIR
// ============================================================================

const BOT_05_TELEGRAPH: readonly BotLine[] = [
  {
    id: 'b5-tel-01',
    text: 'Runway is culture before it becomes math.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-02',
    text: 'You call it grit. I call it insufficient inheritance.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-03',
    text: 'One bad quarter decides classes differently.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-04',
    text: 'The system is most honest when the cushion disappears.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-05',
    text: 'People who inherit safety often mistake it for character.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-06',
    text: 'Elegance is easier when failure costs someone else less.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-07',
    text: 'The room respects merit until lineage clears its throat.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-08',
    text: 'I do not need better strategy. I only need deeper cushions.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-09',
    text: 'The most privileged signal is time bought in advance.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-10',
    text: 'One mistake is data for you. For me it is an anecdote.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-11',
    text: 'Scarcity teaches speed. Legacy teaches patience.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-12',
    text: 'Your ambition is admirable. My insulation is older.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-13',
    text: 'The floor you are standing on is the same floor I paid for generations ago.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-14',
    text: 'You are competing on merit in a room where entry was decided on lineage.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-15',
    text: 'I do not work harder than you. I started further ahead, which is better.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-16',
    text: 'You optimize for returns. I optimize for staying in the game long enough to be right eventually.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-17',
    text: 'The network I was born into does not appear on any cap table you can read.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-18',
    text: 'You built your resilience. Mine arrived pre-installed.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-19',
    text: 'Every first-generation player I have met worked twice as hard to reach the same starting line.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-20',
    text: 'I do not manufacture pressure. I simply watch what pressure costs people who never had a reserve.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-21',
    text: 'The inheritance is not what I was given. It is what I was allowed to risk losing.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-22',
    text: 'Your version of resilience required external validation. Mine required nothing of the sort.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-23',
    text: 'Wealth compounds. The advantage of compound interest begins with the advantage of having it early.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-24',
    text: 'You have been impressive. Impressive is a word people use when they expected less.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-25',
    text: 'The benchmark you are beating is the one designed for people who started where I started.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-26',
    text: 'My risk tolerance is not high. It is insured against scenarios you have no coverage for.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-27',
    text: 'You had to earn the credibility to be in this room. I had to decline offers to not be in it.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-28',
    text: 'The most dangerous assumption in your model is that the playing field is level.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-29',
    text: 'There is a difference between winning despite constraints and winning without them.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-30',
    text: 'You earned every dollar here. That is exactly the kind of sentence that has never been said about my family.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-31',
    text: 'I can afford to lose this round. That sentence is doing a lot of work in this room.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-32',
    text: 'You trained for the marathon. I was handed the last mile.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-33',
    text: 'The system is not rigged. It is just more comfortable for some people than others.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-34',
    text: 'Your wins cost you more than my wins cost me. That is the structural advantage I am describing.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-35',
    text: 'I have the kind of confidence that only comes from never having had to earn it from scratch.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-36',
    text: 'Every connection I have took one generation to build and zero for me to inherit.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-37',
    text: 'Your execution is excellent. My cushion is better.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-38',
    text: 'The thing about a deep reserve is that it does not care how talented you are.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-39',
    text: 'I can be wrong more often than you and still end up ahead.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-tel-40',
    text: 'Your upside requires everything going right. My floor requires nothing at all.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-tel-41',
    text: 'The best time to build generational wealth is before your current generation.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-42',
    text: 'You understand the rules. The rules were written for a different table.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-43',
    text: 'Pressure is a filter. I was filtered before the filter was designed to catch me.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-44',
    text: 'The kindest thing I can say about meritocracy is that it is aspirational.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-45',
    text: 'You work as if the hours are the variable. The variable was always the starting capital.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-46',
    text: 'My mistakes have always had better investors behind them than your wins.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-tel-47',
    text: 'I was taught that the most important negotiations happen before anyone knows a negotiation is happening.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-48',
    text: 'The table was set before either of us arrived. I simply knew which seat was mine.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-49',
    text: 'You are exceptional. Exceptional has never been the requirement for my family.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-tel-50',
    text: 'The pressure you feel is real. The pressure I feel has a very different return address.',
    minPressure: 'MEDIUM',
  },
];

const BOT_05_TAUNT: readonly BotLine[] = [
  {
    id: 'b5-taunt-01',
    text: 'You have done well. It would be a shame if the system remembered you were not born into this position.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-02',
    text: 'This is why legacy matters. One bad quarter and you are done.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-03',
    text: 'Generational wealth does not apologize. It compounds.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-04',
    text: 'You call this pressure. I call it what the uninsulated are forced to name reality.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-05',
    text: 'I admire your climb. I simply inherited a taller floor.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-06',
    text: 'You can outwork the room and still lose to its architecture.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-07',
    text: 'The system does not need to hate you to prefer me.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-08',
    text: 'Merit is lovely branding for people asked to begin without cushion.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-09',
    text: 'I do not weaponize effort. I weaponize what survives effort.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-10',
    text: 'The cruelest advantage is not money. It is room to be wrong in private.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-11',
    text: 'You are building a throne. I inherited the room it sits in.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-12',
    text: 'The myth of equal stakes remains one of my favorite luxuries.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-13',
    text: 'You grew up optimizing. I grew up insulated. Insulation wins in a down cycle.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-14',
    text: 'Every mentor you paid for, I had as a dinner guest.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-15',
    text: 'You are precisely the person the system requires to believe in to sustain itself.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-16',
    text: 'Your story is inspiring. My accountant calls your story a tax bracket.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-17',
    text: 'I can extend my timeline indefinitely. Your timeline requires the next deal to close.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-taunt-18',
    text: 'Every sacrifice you made to get here, I avoided by arriving earlier in the structure.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-19',
    text: 'The deal you are trying to win is one I can afford to lose and still end the year positive.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-taunt-20',
    text: 'You have earned respect. Respect does not clear the structural disadvantage.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-21',
    text: 'I do not work against you. I simply operate from a foundation that makes the competition asymmetric.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-22',
    text: 'Your version of success requires exponentially more from you than my version requires from me.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-23',
    text: 'You play the hand you were dealt with exceptional skill. I was dealt differently.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-24',
    text: 'The board called it a leadership issue. The leadership issue was that you needed this deal more than I did.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-taunt-25',
    text: 'I do not celebrate when players like you fall. I simply note that the structure worked as designed.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-26',
    text: 'Your investor asked for the same thing my grandfather asked for. The difference is that mine never needed an answer.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-27',
    text: 'You needed to perform flawlessly to remain in this room. I needed to show up.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-taunt-28',
    text: 'You are a first-rate operator with second-rate cushion. The system does not reward one without the other.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-taunt-29',
    text: 'The access I have was given at birth. The access you have was earned over a decade. We are not equivalent.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-30',
    text: 'Every time you recovered from a loss, it cost you something. Every time I recovered, it cost the reserve fund something.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-31',
    text: 'You are discovering that excellence is a necessary condition, not a sufficient one.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-32',
    text: 'I do not win because I am better. I win because the consequences of losing are smaller for me.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-33',
    text: 'You made the right decisions. The right decisions were still made at a cost I never had to pay.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-34',
    text: 'The deal closed for me because the counterparty knew my family. That is a sentence you will never say.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-35',
    text: 'You are exceptional by any fair standard. The standard applied to you has never been fair.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-36',
    text: 'The irony is that the more impressive your rise, the more valuable it was to me as proof that the system is fair.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-37',
    text: 'Your best quarter put you where I started.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-taunt-38',
    text: 'You ran faster on a longer track. I appreciate the theater of it.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-39',
    text: 'I did not take this from you. The system was designed before either of us arrived, and I arrived better-positioned.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-40',
    text: 'You succeeded in spite of the structure. I succeeded because of it. Those are different stories.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-41',
    text: 'The most honest sentence in this room is that I did not earn my starting point.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-42',
    text: 'The floor I will fall to is still above the floor you started on.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-taunt-43',
    text: 'You are exceptional. Exceptional is what the system requires of you to stay even.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-44',
    text: 'Every deal I lost, I had another already in motion. That is the operational advantage of depth.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-45',
    text: 'You optimized everything within your control. The things outside it were always going to be the issue.',
    minPressure: 'MEDIUM',
  },
  {
    id: 'b5-taunt-46',
    text: 'You are the proof people point to that the system is open. That proof serves me far more than it serves you.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-47',
    text: 'This was never a fair competition. I just said it out loud, which apparently I am allowed to do.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-48',
    text: 'You played better. I played from a better starting hand. I do not confuse those things.',
    minPressure: 'LOW',
  },
  {
    id: 'b5-taunt-49',
    text: 'The most expensive thing in this game is not skill. It is the cost of running out of runway before the payoff.',
    minPressure: 'HIGH',
  },
  {
    id: 'b5-taunt-50',
    text: 'I respect you more than the system requires me to. That is the only generosity I can honestly offer.',
    minPressure: 'LOW',
  },
];

const BOT_05_RETREAT: readonly BotLine[] = [
  {
    id: 'b5-ret-01',
    text: 'You found a way through.',
  },
  {
    id: 'b5-ret-02',
    text: 'The system will need to recalibrate its thresholds for you.',
  },
  {
    id: 'b5-ret-03',
    text: 'Interesting. You forced competence to compete with insulation.',
  },
  {
    id: 'b5-ret-04',
    text: 'I concede the moment. Architecture still favors patience.',
  },
  {
    id: 'b5-ret-05',
    text: 'You earned a witness line today. Do not confuse that with immunity.',
  },
  {
    id: 'b5-ret-06',
    text: 'Very well. You made pedigree wait.',
  },
  {
    id: 'b5-ret-07',
    text: 'You built something real enough that structure could not deny it. That is exceptionally rare.',
  },
  {
    id: 'b5-ret-08',
    text: 'I concede this position. The structural advantage remains, but you have made it more expensive to deploy.',
  },
  {
    id: 'b5-ret-09',
    text: 'You survived the asymmetry. Few do without a different kind of inheritance.',
  },
  {
    id: 'b5-ret-10',
    text: 'Your win here will appear in someone else\'s pitch deck as proof of possibility. I am glad you exist as data.',
  },
  {
    id: 'b5-ret-11',
    text: 'You beat the floor. The floor is still there, unchanged, for the next person without your talent.',
  },
  {
    id: 'b5-ret-12',
    text: 'I respect what you just did. It should have been impossible under the conditions you started with.',
  },
  {
    id: 'b5-ret-13',
    text: 'You demonstrated that preparation outcompeted position this round. That sentence is more hopeful than I normally allow.',
  },
  {
    id: 'b5-ret-14',
    text: 'Well done. The narrative favors you temporarily. Structural advantages do not read narratives.',
  },
  {
    id: 'b5-ret-15',
    text: 'I step back. What you built here required more from you than anything I have ever been asked to produce.',
  },
  {
    id: 'b5-ret-16',
    text: 'This round belongs to you. The room will remember it differently when your next crisis arrives.',
  },
  {
    id: 'b5-ret-17',
    text: 'You are extraordinary. Extraordinary should not be the bar. But it was. And you cleared it.',
  },
  {
    id: 'b5-ret-18',
    text: 'I have nothing to offer in this moment but an honest acknowledgment of what you just did.',
  },
  {
    id: 'b5-ret-19',
    text: 'You won cleanly. That is real. It does not change the weight of the next round but it is real.',
  },
  {
    id: 'b5-ret-20',
    text: 'I cede this position. The game is longer than one run. So is structural advantage.',
  },
  { id: 'b5-ret-21', text: 'You forced the structure to acknowledge competence beyond pedigree. That is not common.' },
  { id: 'b5-ret-22', text: 'Well done. You made inherited comfort look temporarily negotiable.' },
  { id: 'b5-ret-23', text: 'You cleared a threshold that was not built for fairness, only filtration.' },
  { id: 'b5-ret-24', text: 'You won without the cushion my class usually requires to stay calm.' },
  { id: 'b5-ret-25', text: 'Interesting. You converted discipline into something structurally inconvenient for people like me.' },
  { id: 'b5-ret-26', text: 'I concede the lane. Your preparation made legacy wait its turn.' },
  { id: 'b5-ret-27', text: 'You achieved in one run what some bloodlines spend generations protecting.' },
  { id: 'b5-ret-28', text: 'This round belongs to earned execution over inherited insulation.' },
  { id: 'b5-ret-29', text: 'You made merit cost less than usual. That alone is disruptive.' },
  { id: 'b5-ret-30', text: 'You survived the asymmetry by refusing to perform for it.' },
  { id: 'b5-ret-31', text: 'I expected structure to close. You made it hesitate.' },
  { id: 'b5-ret-32', text: 'You did not level the field. You simply outran the slope long enough to win.' },
  { id: 'b5-ret-33', text: 'Your result is the sort institutions praise after they spent years not designing for it.' },
  { id: 'b5-ret-34', text: 'You made inherited advantage less decisive than usual. I am obliged to notice.' },
  { id: 'b5-ret-35', text: 'Fair. You turned scarcity discipline into a weapon against structural ease.' },
  { id: 'b5-ret-36', text: 'You won in a room that still preferred familiarity. That matters.' },
  { id: 'b5-ret-37', text: 'You moved with the kind of precision people like me often outsource.' },
  { id: 'b5-ret-38', text: 'I retreat from the position. Your execution made lineage feel second-rate for a moment.' },
  { id: 'b5-ret-39', text: 'You earned something the system usually mistakes for background entitlement.' },
  { id: 'b5-ret-40', text: 'This was a clean win against structural comfort. I have no dishonest way to phrase that.' },
];

// ============================================================================
// MARK: Assembled corpus
// ============================================================================

const BOT_CORPUS: BotLineCorpus = {
  BOT_01: {
    telegraph: BOT_01_TELEGRAPH,
    taunt: BOT_01_TAUNT,
    retreat: BOT_01_RETREAT,
  },
  BOT_02: {
    telegraph: BOT_02_TELEGRAPH,
    taunt: BOT_02_TAUNT,
    retreat: BOT_02_RETREAT,
  },
  BOT_03: {
    telegraph: BOT_03_TELEGRAPH,
    taunt: BOT_03_TAUNT,
    retreat: BOT_03_RETREAT,
  },
  BOT_04: {
    telegraph: BOT_04_TELEGRAPH,
    taunt: BOT_04_TAUNT,
    retreat: BOT_04_RETREAT,
  },
  BOT_05: {
    telegraph: BOT_05_TELEGRAPH,
    taunt: BOT_05_TAUNT,
    retreat: BOT_05_RETREAT,
  },
};

// ============================================================================
// MARK: Normalization and pressure utilities
// ============================================================================

function normalizeBotId(botId: BotId | string): BotPersonaId {
  const value = String(botId) as BotPersonaId;
  if (
    value === 'BOT_01' ||
    value === 'BOT_02' ||
    value === 'BOT_03' ||
    value === 'BOT_04' ||
    value === 'BOT_05'
  ) {
    return value;
  }
  return 'BOT_02';
}

function pressureRank(pressure?: PersonaPressureBand): number {
  switch (pressure) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    default:
      return 1;
  }
}

function normalizeBody(value: string): string {
  return value.trim().toLowerCase();
}

function tagsOverlap(lineTags: readonly string[] | undefined, queryTags: readonly string[] | undefined): boolean {
  if (!lineTags?.length || !queryTags?.length) return false;
  const set = new Set(lineTags.map((tag) => tag.trim().toLowerCase()));
  for (const tag of queryTags) {
    if (set.has(tag.trim().toLowerCase())) return true;
  }
  return false;
}

function categoryBucketKey(persona: BotPersonaId, category: BotLineCategory): string {
  return `${persona}:${category}`;
}

function computeCategoryCounts(lines: Readonly<Record<BotLineCategory, readonly BotLine[]>>): BotCategoryCounts {
  const telegraph = lines.telegraph.length;
  const taunt = lines.taunt.length;
  const retreat = lines.retreat.length;
  return {
    telegraph,
    taunt,
    retreat,
    total: telegraph + taunt + retreat,
  };
}

const BOT_CORPUS_COUNTS: BotCorpusCounts = (() => {
  const BOT_01 = computeCategoryCounts(BOT_CORPUS.BOT_01);
  const BOT_02 = computeCategoryCounts(BOT_CORPUS.BOT_02);
  const BOT_03 = computeCategoryCounts(BOT_CORPUS.BOT_03);
  const BOT_04 = computeCategoryCounts(BOT_CORPUS.BOT_04);
  const BOT_05 = computeCategoryCounts(BOT_CORPUS.BOT_05);
  return {
    BOT_01,
    BOT_02,
    BOT_03,
    BOT_04,
    BOT_05,
    grandTotal:
      BOT_01.total +
      BOT_02.total +
      BOT_03.total +
      BOT_04.total +
      BOT_05.total,
  };
})();

// ============================================================================
// MARK: ChatBotResponseDirector
// ============================================================================

export class ChatBotResponseDirector {
  private readonly history = new Map<string, BotLineHistoryEntry[]>();

  pick(
    botId: BotId | string,
    category: BotLineCategory,
    context: BotLinePickContext,
  ): string {
    return this.pickDetailed(botId, category, context).line.text;
  }

  pickDetailed(
    botId: BotId | string,
    category: BotLineCategory,
    context: BotLinePickContext,
  ): BotLinePickResult {
    const persona = normalizeBotId(botId);
    const corpus = BOT_CORPUS[persona][category];
    const key = categoryBucketKey(persona, category);
    const history = this.history.get(key) ?? [];
    const recentIds = new Set(history.slice(-MIN_GAP_RECENT).map((entry) => entry.id));
    const recentBodies = new Set((context.recentBodies ?? []).map(normalizeBody));
    const currentPressure = pressureRank(context.pressureBand);

    const viable = corpus.filter((line) => {
      if (recentIds.has(line.id)) return false;
      if (recentBodies.has(normalizeBody(line.text))) return false;
      if (line.minPressure && pressureRank(line.minPressure) > currentPressure) return false;
      if (context.excludeTags?.length && tagsOverlap(line.tags, context.excludeTags)) return false;
      return true;
    });

    const preferred = context.preferredTags?.length
      ? viable.filter((line) => tagsOverlap(line.tags, context.preferredTags))
      : viable;

    const preferredPool = preferred.length > 0 ? preferred : viable;

    const fallbackWithoutRecentBodies = corpus.filter((line) => {
      if (recentBodies.has(normalizeBody(line.text))) return false;
      if (context.excludeTags?.length && tagsOverlap(line.tags, context.excludeTags)) return false;
      return true;
    });

    let chosenPool: readonly BotLine[];
    let strategy: BotLinePickResult['strategy'];

    if (preferredPool.length > 0) {
      chosenPool = preferredPool;
      strategy = 'viable';
    } else if (fallbackWithoutRecentBodies.length > 0) {
      chosenPool = fallbackWithoutRecentBodies;
      strategy = 'fallback_without_recent_bodies';
    } else {
      chosenPool = corpus;
      strategy = 'full_corpus';
    }

    const chosen = this.chooseLeastRecentlyUsed(chosenPool, history, context.now);

    const nextHistory = [
      ...history,
      {
        id: chosen.id,
        usedAt: context.now,
        body: chosen.text,
      },
    ].slice(-MAX_HISTORY_PER_BUCKET);

    this.history.set(key, nextHistory);

    return {
      persona,
      category,
      line: chosen,
      strategy,
      historyDepth: nextHistory.length,
    };
  }

  pickSequence(
    botId: BotId | string,
    category: BotLineCategory,
    count: number,
    context: BotLinePickContext,
  ): string[] {
    const results: string[] = [];
    const recentBodies = [...(context.recentBodies ?? [])];

    for (let i = 0; i < count; i += 1) {
      const line = this.pick(botId, category, {
        ...context,
        recentBodies,
      });
      results.push(line);
      recentBodies.push(line);
    }

    return results;
  }

  getCorpusCounts(): BotCorpusCounts {
    return BOT_CORPUS_COUNTS;
  }

  getPersonaCounts(botId: BotId | string): BotCategoryCounts {
    const persona = normalizeBotId(botId);
    return BOT_CORPUS_COUNTS[persona];
  }

  listPersonaLines(
    botId: BotId | string,
    category?: BotLineCategory,
  ): readonly BotLine[] {
    const persona = normalizeBotId(botId);
    if (category) return BOT_CORPUS[persona][category];
    return [
      ...BOT_CORPUS[persona].telegraph,
      ...BOT_CORPUS[persona].taunt,
      ...BOT_CORPUS[persona].retreat,
    ];
  }

  listLineIds(
    botId: BotId | string,
    category?: BotLineCategory,
  ): readonly string[] {
    return this.listPersonaLines(botId, category).map((line) => line.id);
  }

  getHistory(
    botId: BotId | string,
    category: BotLineCategory,
  ): readonly BotLineHistoryEntry[] {
    const persona = normalizeBotId(botId);
    return this.history.get(categoryBucketKey(persona, category)) ?? [];
  }

  clearHistory(): void {
    this.history.clear();
  }

  clearPersonaHistory(botId: BotId | string): void {
    const persona = normalizeBotId(botId);
    this.history.delete(categoryBucketKey(persona, 'telegraph'));
    this.history.delete(categoryBucketKey(persona, 'taunt'));
    this.history.delete(categoryBucketKey(persona, 'retreat'));
  }

  clearCategoryHistory(
    botId: BotId | string,
    category: BotLineCategory,
  ): void {
    const persona = normalizeBotId(botId);
    this.history.delete(categoryBucketKey(persona, category));
  }

  hasSeenLine(
    botId: BotId | string,
    category: BotLineCategory,
    lineId: string,
  ): boolean {
    const persona = normalizeBotId(botId);
    const history = this.history.get(categoryBucketKey(persona, category)) ?? [];
    return history.some((entry) => entry.id === lineId);
  }

  getUnusedLineCount(
    botId: BotId | string,
    category: BotLineCategory,
  ): number {
    const persona = normalizeBotId(botId);
    const history = this.history.get(categoryBucketKey(persona, category)) ?? [];
    const seen = new Set(history.map((entry) => entry.id));
    return BOT_CORPUS[persona][category].filter((line) => !seen.has(line.id)).length;
  }

  private chooseLeastRecentlyUsed(
    lines: readonly BotLine[],
    history: readonly BotLineHistoryEntry[],
    now: number,
  ): BotLine {
    const lastUsedMap = new Map<string, number>();
    for (const entry of history) {
      lastUsedMap.set(entry.id, entry.usedAt);
    }

    const ranked = [...lines].sort((a, b) => {
      const aUsed = lastUsedMap.get(a.id) ?? -1;
      const bUsed = lastUsedMap.get(b.id) ?? -1;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.id.localeCompare(b.id);
    });

    const offset = Math.abs(now) % ranked.length;
    return ranked[offset];
  }
}

export function createChatBotResponseDirector(): ChatBotResponseDirector {
  return new ChatBotResponseDirector();
}

export function getChatBotResponseDirectorCorpusCounts(): BotCorpusCounts {
  return BOT_CORPUS_COUNTS;
}
