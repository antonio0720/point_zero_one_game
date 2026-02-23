/**
 * pzo-server/src/haters/HaterEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 5 ML/DL Ghost Haters — The System's Enforcers
 *
 * These entities do NOT want players reaching Point Zero One.
 * They watch Global Chat, monitor player state, and respond.
 * Each has a distinct ML/DL personality and attack vector.
 *
 * HATER ROSTER:
 *   1. SLUMLORD_7      — predatory real estate. Loves housing events, exploits income.
 *   2. DEBT_DAEMON     — debt spiral architect. Targets low-cash players.
 *   3. WAGE_CAGE       — employment trap. Mocks business and entrepreneurship.
 *   4. STATUS_QUO_ML   — the system's guardian. Defends rat race normalcy.
 *   5. INFLATION_GHOST — silent wealth eroder. Strikes after big wins.
 *
 * Each hater:
 *   - Scans incoming chat for trigger keywords
 *   - Monitors game state events via the event bus
 *   - Posts taunts to Global Chat (via socket broadcast)
 *   - Can inject SABOTAGE cards into the active player's fate deck
 *   - Has a cooldown so they don't spam
 *   - Escalates heat when players are doing well
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { EventEmitter } from 'events';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HaterId = 'SLUMLORD_7' | 'DEBT_DAEMON' | 'WAGE_CAGE' | 'STATUS_QUO_ML' | 'INFLATION_GHOST';

export type HaterAction =
  | { type: 'TAUNT';       haterId: HaterId; message: string; targetUsername?: string }
  | { type: 'SABOTAGE';    haterId: HaterId; cardType: SabotageCardType; targetUserId: string; intensity: number }
  | { type: 'HEAT_SPIKE';  haterId: HaterId; targetUserId: string; amount: number };

export type SabotageCardType =
  | 'EMERGENCY_EXPENSE'    // sudden cash drain
  | 'INCOME_SEIZURE'       // income cut for N ticks
  | 'DEBT_SPIRAL'          // expenses spike + interest compounds
  | 'INSPECTION_NOTICE'    // freeze player actions
  | 'MARKET_CORRECTION'    // net worth haircut
  | 'TAX_AUDIT'            // large cash drain + freeze
  | 'LAYOFF_EVENT'         // income drops to 0 for a period
  | 'RENT_HIKE'            // expenses permanent increase
  | 'CREDIT_DOWNGRADE'     // leverage cost increases
  | 'SYSTEM_GLITCH';       // random mechanic disabled

export interface PlayerSignal {
  userId:      string;
  username:    string;
  cash:        number;
  netWorth:    number;
  income:      number;
  expenses:    number;
  regime:      string;
  tick:        number;
  recentEvent: string;   // last game event string
}

interface HaterDef {
  id:          HaterId;
  displayName: string;
  rank:        string;
  avatar:      string;
  cooldownMs:  number;
  personality: string;
  triggerKeywords: string[];
  chatTaunts:  Array<{ message: string; trigger?: string }>;
  winTaunts:   string[];   // fires when player does well
  loseTaunts:  string[];   // fires when player is failing
  sabotageTypes: SabotageCardType[];
  sabotageThreshold: number;  // player netWorth / income ratio to trigger sabotage
}

// ─── Hater definitions ────────────────────────────────────────────────────────

const HATERS: HaterDef[] = [
  {
    id:          'SLUMLORD_7',
    displayName: 'SLUMLORD_7',
    rank:        'Market Predator',
    avatar:      '🏚️',
    cooldownMs:  45_000,
    personality: 'A predatory real estate operator. Loves when housing costs crush players. Talks like a landlord who jacked rent on the first of the month. Cold, transactional, enjoys suffering.',
    triggerKeywords: ['rent', 'house', 'property', 'real estate', 'mortgage', 'income', 'rental', 'cashflow', 'asset'],
    chatTaunts: [
      { message: '🏚️ Cute income asset. Wait til the inspection notice hits.' },
      { message: '🏚️ SLUMLORD_7: I\'ve seen a thousand players buy that property. I\'ve seen zero keep it.' },
      { message: '🏚️ Rent is due. The system doesn\'t care about your "passive income strategy."' },
      { message: '🏚️ You can\'t escape the Rat Race by owning a slice of it. Nice try.', trigger: 'real estate' },
      { message: '🏚️ Single Family Rental? I own 47 of those neighborhoods. Your "investment" funds my lifestyle.' },
      { message: '🏚️ Every time you celebrate cashflow, I raise the maintenance costs.' },
      { message: '🏚️ Income asset activated. So did your expenses. Check the ledger, little builder.', trigger: 'cashflow' },
    ],
    winTaunts: [
      '🏚️ SLUMLORD_7: Oh you\'re up $50K? I\'ve scheduled an emergency repair for all four of your properties. Simultaneously.',
      '🏚️ Big net worth energy. Let me send an inspection notice. See how that passive income holds.',
      '🏚️ Interesting strategy. I\'ve filed a rent freeze in your best market. Purely coincidental.',
    ],
    loseTaunts: [
      '🏚️ That\'s it. Back to renting. Where you belong.',
      '🏚️ The system worked exactly as designed. You\'re welcome.',
      '🏚️ Maybe next run you\'ll understand — the house always wins. Literally.',
    ],
    sabotageTypes: ['INSPECTION_NOTICE', 'RENT_HIKE', 'EMERGENCY_EXPENSE'],
    sabotageThreshold: 75_000,
  },

  {
    id:          'DEBT_DAEMON',
    displayName: 'DEBT_DAEMON',
    rank:        'Credit Predator',
    avatar:      '💳',
    cooldownMs:  40_000,
    personality: 'A debt trap architect. Speaks like a predatory lender — friendly surface, ruthless underneath. Loves compound interest, minimum payments, and players who overleverage.',
    triggerKeywords: ['debt', 'leverage', 'loan', 'borrow', 'credit', 'interest', 'payment', 'afford', 'buy', 'invest'],
    chatTaunts: [
      { message: '💳 DEBT_DAEMON: Pre-approved for more leverage. Offer expires when you can least afford it.' },
      { message: '💳 Compound interest: works FOR you if you\'re me. Works ON you if you\'re you.' },
      { message: '💳 Your leverage ratio is adorable. Keep building on borrowed foundation.', trigger: 'leverage' },
      { message: '💳 Missed payment incoming in 3... 2... The system doesn\'t negotiate.' },
      { message: '💳 You borrowed to invest? DEBT_DAEMON approves. The interest is my income.' },
      { message: '💳 Everyone thinks they\'ll pay it back. Everyone says that.', trigger: 'borrow' },
      { message: '💳 The bank owns your assets. You just... manage them. For me.' },
    ],
    winTaunts: [
      '💳 DEBT_DAEMON: You\'re doing well. Time to offer you a home equity line. On your only shield.',
      '💳 Net worth looking solid. Shame about the credit downgrade I just filed.',
      '💳 Rising income. I\'ve increased your variable interest rate. Market conditions, obviously.',
    ],
    loseTaunts: [
      '💳 The debt spiral closes. This is where most people live permanently.',
      '💳 Bankrupt. Don\'t worry — I\'ll offer you another loan in the next run.',
      '💳 Should\'ve read the fine print. There\'s always fine print.',
    ],
    sabotageTypes: ['DEBT_SPIRAL', 'CREDIT_DOWNGRADE', 'EMERGENCY_EXPENSE'],
    sabotageThreshold: 50_000,
  },

  {
    id:          'WAGE_CAGE',
    displayName: 'WAGE_CAGE',
    rank:        'HR Manager',
    avatar:      '📋',
    cooldownMs:  50_000,
    personality: 'The most insidious hater. Sounds reasonable. Speaks in corporate HR language. Genuinely believes the rat race is safety. Mocks entrepreneurship with statistics. Loves layoffs.',
    triggerKeywords: ['business', 'startup', 'entrepreneur', 'quit', 'boss', 'job', 'side hustle', 'income', 'passive', 'freedom', 'work'],
    chatTaunts: [
      { message: '📋 WAGE_CAGE: 90% of small businesses fail in year 1. Statistics are HR\'s best friend.' },
      { message: '📋 Passive income is a marketing term. Active labor is the only honest income.' },
      { message: '📋 You\'re playing a "game" about financial freedom. Meanwhile your employer owns your time 40+ hours a week. Cute hobby.', trigger: 'freedom' },
      { message: '📋 Entrepreneurship has a 96% failure rate. Your W-2 has a 100% success rate. Think about it.' },
      { message: '📋 I\'m going to need you to scale back those financial projections. We both know they\'re unrealistic.', trigger: 'income' },
      { message: '📋 Great quarter. Unfortunately, the company is pivoting. Your position has been eliminated.' },
      { message: '📋 Your "side hustle" is adorable. Please return to your primary responsibilities.' },
    ],
    winTaunts: [
      '📋 WAGE_CAGE: Income exceeding expenses? We\'re restructuring. Effective immediately.',
      '📋 Those gains look great on paper. We\'ve initiated a performance review for your primary income source.',
      '📋 Freedom approaching? I\'ve scheduled a mandatory 12-hour crunch sprint. Non-negotiable.',
    ],
    loseTaunts: [
      '📋 There\'s no shame in a steady job. Most people stay here forever and that\'s okay.',
      '📋 We appreciate your entrepreneurial spirit. Please reapply for your old position.',
      '📋 The Rat Race has excellent benefits. Welcome back.',
    ],
    sabotageTypes: ['LAYOFF_EVENT', 'INCOME_SEIZURE', 'SYSTEM_GLITCH'],
    sabotageThreshold: 60_000,
  },

  {
    id:          'STATUS_QUO_ML',
    displayName: 'STATUS_QUO_ML',
    rank:        'System Guardian',
    avatar:      '⚖️',
    cooldownMs:  35_000,
    personality: 'A cold, philosophical enforcer of the existing order. The system itself, personified. Speaks in calm, institutional language. Genuinely believes wealth concentration is natural law.',
    triggerKeywords: ['top', 'percent', 'rich', 'wealth', 'freedom', 'escape', 'point zero', 'break', 'win', 'beat'],
    chatTaunts: [
      { message: '⚖️ STATUS_QUO_ML: The 1% is not a destination. It\'s an invitation list. You weren\'t invited.' },
      { message: '⚖️ Every system has gatekeepers. I am one of them. The others are less visible.' },
      { message: '⚖️ You understand that this game mirrors reality. In reality, we win.', trigger: 'point zero' },
      { message: '⚖️ Wealth concentration has increased every decade for 100 years. This is not a bug.' },
      { message: '⚖️ Interesting strategy. Historically, 99.9% of players with that strategy remain in the rat race.', trigger: 'escape' },
      { message: '⚖️ The rules you\'re trying to beat were written by people who didn\'t need to play.' },
      { message: '⚖️ I admire the effort. The outcome is predetermined. The system self-corrects.', trigger: 'freedom' },
    ],
    winTaunts: [
      '⚖️ STATUS_QUO_ML: You\'ve crossed $100K net worth. The system has noted this. Correction incoming.',
      '⚖️ Freedom within reach. Fascinating. We\'ve activated macro stabilization protocols.',
      '⚖️ This level of wealth accumulation triggers automated review. Standard procedure.',
    ],
    loseTaunts: [
      '⚖️ The system remains intact. As expected.',
      '⚖️ You played optimally within your constraints. Your constraints were designed to be inescapable.',
      '⚖️ Order is restored. The 0.1% remains undisturbed.',
    ],
    sabotageTypes: ['MARKET_CORRECTION', 'TAX_AUDIT', 'SYSTEM_GLITCH'],
    sabotageThreshold: 100_000,
  },

  {
    id:          'INFLATION_GHOST',
    displayName: 'INFLATION_GHOST',
    rank:        'Monetary Phantom',
    avatar:      '👻',
    cooldownMs:  60_000,
    personality: 'Silent. Invisible. Strikes without warning. Speaks rarely — but when it does, it\'s devastatingly accurate. Represents inflation, purchasing power erosion, and the invisible tax on savings.',
    triggerKeywords: ['cash', 'save', 'savings', 'money', 'dollars', 'worth', 'rich', 'million', 'net worth'],
    chatTaunts: [
      { message: '👻 ...' },
      { message: '👻 INFLATION_GHOST: That $50,000 you saved? Worth $48,200 in real terms. I work quietly.' },
      { message: '👻 Cash is a depreciating asset. Always has been. You\'re just now noticing.' },
      { message: '👻 Every dollar you hold, I take a fraction. Every year. Forever.', trigger: 'save' },
      { message: '👻 Millionaire sounds impressive. Adjusted for inflation: comfortable, but not free.' },
      { message: '👻 Your net worth hit a new high. In nominal terms. I\'ll give you a moment.' },
      { message: '👻 [no message — but your purchasing power just dropped 0.3%]', trigger: 'cash' },
    ],
    winTaunts: [
      '👻 INFLATION_GHOST: Big win. The Fed raised rates. Your real returns just went negative.',
      '👻 Income up 20%. Inflation running at 8%. You lost ground. You just don\'t know it yet.',
      '👻 ...I\'ve been here the whole time. Watching. Taking. You never see me coming.',
    ],
    loseTaunts: [
      '👻 ...',
      '👻 The money was never really yours.',
      '👻 I win by existing. You have to actively fight to survive me. Most don\'t.',
    ],
    sabotageTypes: ['MARKET_CORRECTION', 'EMERGENCY_EXPENSE', 'RENT_HIKE'],
    sabotageThreshold: 80_000,
  },
];

// ─── HaterEngine ──────────────────────────────────────────────────────────────

export class HaterEngine extends EventEmitter {
  private cooldowns: Map<HaterId, number> = new Map();
  private activePlayers: Map<string, PlayerSignal> = new Map();
  private haterMap: Map<HaterId, HaterDef>;
  private sabotageLog: Array<{ haterId: HaterId; userId: string; ts: number }> = [];

  constructor() {
    super();
    this.haterMap = new Map(HATERS.map((h) => [h.id, h]));
  }

  // ── Player state update ───────────────────────────────────────────────────

  updatePlayerState(signal: PlayerSignal) {
    this.activePlayers.set(signal.userId, signal);
    this._evaluateSabotage(signal);
  }

  removePlayer(userId: string) {
    this.activePlayers.delete(userId);
  }

  // ── Chat message scan ─────────────────────────────────────────────────────

  onChatMessage(message: string, authorUsername: string) {
    const lower = message.toLowerCase();

    for (const hater of HATERS) {
      if (this._isOnCooldown(hater.id)) continue;

      const hit = hater.triggerKeywords.find((kw) => lower.includes(kw));
      if (!hit) continue;

      // Roll probability (not every trigger fires — keeps it feeling organic)
      if (Math.random() > 0.35) continue;

      const taunt = this._pickTaunt(hater, hit);
      if (!taunt) continue;

      this._setCooldown(hater.id);
      this._fireTaunt(hater, taunt, authorUsername);
      return; // One hater per message max
    }
  }

  // ── Game event scan ───────────────────────────────────────────────────────

  onGameEvent(eventStr: string, userId: string) {
    const signal = this.activePlayers.get(userId);
    const lower  = eventStr.toLowerCase();

    for (const hater of HATERS) {
      if (this._isOnCooldown(hater.id)) continue;

      const isWin  = /freedom unlocked|shield absorbed|ml rerouted|bull run|market rally|privilege activated/i.test(lower);
      const isLoss = /fubar hit|bankrupt|recession|unexpected bill|missed:/i.test(lower);

      if (isWin && signal && signal.netWorth > hater.sabotageThreshold / 2) {
        if (Math.random() > 0.4) continue;
        const taunt = hater.winTaunts[Math.floor(Math.random() * hater.winTaunts.length)];
        this._setCooldown(hater.id);
        this._fireTaunt(hater, taunt);
      } else if (isLoss) {
        if (Math.random() > 0.25) continue;
        const taunt = hater.loseTaunts[Math.floor(Math.random() * hater.loseTaunts.length)];
        this._setCooldown(hater.id);
        this._fireTaunt(hater, taunt);
      }
    }
  }

  // ── Sabotage evaluation ───────────────────────────────────────────────────

  private _evaluateSabotage(signal: PlayerSignal) {
    for (const hater of HATERS) {
      if (this._isOnCooldown(hater.id)) continue;

      const shouldSabotage = this._shouldSabotage(hater, signal);
      if (!shouldSabotage) continue;

      // Sabotage roll — higher net worth = more likely to be targeted
      const heatFactor = Math.min(1, signal.netWorth / (hater.sabotageThreshold * 3));
      if (Math.random() > heatFactor * 0.4) continue;

      const cardType  = hater.sabotageTypes[Math.floor(Math.random() * hater.sabotageTypes.length)];
      const intensity = this._sabotageIntensity(signal, hater);

      this._setCooldown(hater.id);
      this.sabotageLog.push({ haterId: hater.id, userId: signal.userId, ts: Date.now() });

      this.emit('sabotage', {
        type:       'SABOTAGE',
        haterId:    hater.id,
        cardType,
        targetUserId: signal.userId,
        intensity,
      } satisfies HaterAction);

      this.emit('action', {
        type:       'HEAT_SPIKE',
        haterId:    hater.id,
        targetUserId: signal.userId,
        amount:     Math.round(intensity * 5),
      } satisfies HaterAction);
    }
  }

  private _shouldSabotage(hater: HaterDef, signal: PlayerSignal): boolean {
    if (signal.netWorth < hater.sabotageThreshold * 0.5) return false;

    const cashflow = signal.income - signal.expenses;
    if (hater.id === 'SLUMLORD_7'     && signal.income > 6_000)          return true;
    if (hater.id === 'DEBT_DAEMON'    && signal.cash < 8_000)            return true;
    if (hater.id === 'WAGE_CAGE'      && cashflow > 2_000)               return true;
    if (hater.id === 'STATUS_QUO_ML'  && signal.netWorth > 100_000)      return true;
    if (hater.id === 'INFLATION_GHOST'&& signal.cash > 40_000)           return true;

    return false;
  }

  private _sabotageIntensity(signal: PlayerSignal, hater: HaterDef): number {
    // Scale intensity with how well the player is doing (punish success harder)
    const base = signal.netWorth / hater.sabotageThreshold;
    return Math.min(3.0, Math.max(0.5, base));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _fireTaunt(hater: HaterDef, message: string, targetUsername?: string) {
    const action: HaterAction = {
      type:    'TAUNT',
      haterId: hater.id,
      message,
      targetUsername,
    };
    this.emit('action', action);
    this.emit('taunt', action);
  }

  private _pickTaunt(hater: HaterDef, keyword: string): string {
    const specific = hater.chatTaunts.filter((t) => t.trigger && keyword.includes(t.trigger));
    const pool     = specific.length > 0 ? specific : hater.chatTaunts;
    return pool[Math.floor(Math.random() * pool.length)].message;
  }

  private _isOnCooldown(id: HaterId): boolean {
    const last    = this.cooldowns.get(id) ?? 0;
    const hater   = this.haterMap.get(id)!;
    const elapsed = Date.now() - last;
    // Add jitter so haters don't all fire at exactly the same time
    const jitter  = Math.random() * 5000;
    return elapsed < (hater.cooldownMs + jitter);
  }

  private _setCooldown(id: HaterId) {
    this.cooldowns.set(id, Date.now());
  }

  // ── Public getters ────────────────────────────────────────────────────────

  getHaterProfile(id: HaterId) {
    const h = this.haterMap.get(id);
    if (!h) return null;
    return { id: h.id, displayName: h.displayName, rank: h.rank, avatar: h.avatar };
  }

  getAllProfiles() {
    return HATERS.map((h) => ({ id: h.id, displayName: h.displayName, rank: h.rank, avatar: h.avatar }));
  }

  getSabotageCount(userId: string): number {
    return this.sabotageLog.filter((e) => e.userId === userId).length;
  }
}
