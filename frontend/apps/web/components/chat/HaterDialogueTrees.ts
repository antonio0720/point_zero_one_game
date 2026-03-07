/**
 * HaterDialogueTrees.ts — PZO Sovereign Chat · Adaptive Dialogue
 * 50+ unique context-triggered lines per bot. ML-weighted selection.
 * Density6 LLC · Point Zero One · Confidential
 */

// ─── Context triggers ─────────────────────────────────────────────────────────

export type DialogueContext =
  | 'PLAYER_NEAR_BANKRUPTCY'
  | 'PLAYER_INCOME_UP'
  | 'PLAYER_SHIELD_BREAK'
  | 'PLAYER_CARD_PLAY'
  | 'PLAYER_IDLE'
  | 'PLAYER_COMEBACK'
  | 'PLAYER_RESPONSE_ANGRY'
  | 'PLAYER_RESPONSE_TROLL'
  | 'PLAYER_RESPONSE_FLEX'
  | 'PLAYER_FIRST_INCOME'
  | 'BOT_DEFEATED'
  | 'BOT_WINNING'
  | 'TIME_PRESSURE'
  | 'CASCADE_CHAIN'
  | 'GAME_START'
  | 'NEAR_SOVEREIGNTY'
  | 'PLAYER_LOST'
  | 'LOBBY_TAUNT';

export interface DialogueLine {
  text: string;
  weight: number;    // 0-1, higher = more likely to be picked
  minTick?: number;  // only available after this tick
  maxUses?: number;  // max times this line can fire per run
}

export type DialogueTree = Record<DialogueContext, DialogueLine[]>;

// ─── THE LIQUIDATOR ───────────────────────────────────────────────────────────

export const LIQUIDATOR_TREE: DialogueTree = {
  LOBBY_TAUNT: [
    { text: "Another one walks in. Let me check... no savings, no plan, no shield. This won't take long.", weight: 0.8 },
    { text: "I liquidated three players before breakfast. You're what — number four?", weight: 0.7 },
    { text: "The market loves fresh meat. Welcome.", weight: 0.6 },
    { text: "You look like you've never survived a margin call. This should be educational.", weight: 0.5 },
  ],
  GAME_START: [
    { text: "Clock's running. Your assets start depreciating... now.", weight: 0.9 },
    { text: "I've seen this opening a thousand times. They always think they're different.", weight: 0.7 },
    { text: "Let's see how long your liquidity lasts when I start applying pressure.", weight: 0.8 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "Your assets are priced for distress. I'm simply here to help the market find the floor.", weight: 0.9 },
    { text: "The numbers don't lie. You're underwater. Want me to run the math?", weight: 0.8 },
    { text: "That sound? That's your net worth hitting single digits.", weight: 0.7 },
    { text: "I've seen empires fall slower than this. You're setting records.", weight: 0.6 },
    { text: "Your cashflow just went negative. The vultures are circling. I should know — I'm one of them.", weight: 0.8 },
    { text: "Bankruptcy isn't failure. It's just... the expected outcome for someone with your strategy.", weight: 0.5 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Income up? Cute. Let me introduce you to something called 'unexpected expenses.'", weight: 0.9 },
    { text: "You built a revenue stream. Congratulations. Now watch me redirect it.", weight: 0.8 },
    { text: "Every dollar you earn makes you a more interesting target. Keep going.", weight: 0.7 },
    { text: "Cashflow positive. Finally. I was getting bored waiting for something worth taking.", weight: 0.6 },
    { text: "You think income protects you? Income just means you have something to lose.", weight: 0.5 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield down. You feel that? That's exposure. That's reality without a buffer.", weight: 0.9 },
    { text: "One layer gone. Three to go. Tick tock.", weight: 0.8 },
    { text: "Your protection just vaporized. The market doesn't give second chances.", weight: 0.7 },
    { text: "Breach detected. Recalculating your asset value... downward.", weight: 0.6 },
    { text: "Without that shield, you're just cash sitting in the open. My favorite kind of target.", weight: 0.8 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "Interesting card choice. Wrong, but interesting.", weight: 0.7 },
    { text: "That card? In this market? Bold. Stupid, but bold.", weight: 0.8 },
    { text: "I've seen that play before. It didn't work then either.", weight: 0.6 },
    { text: "Noted. Adjusting my attack vector accordingly.", weight: 0.5 },
  ],
  PLAYER_IDLE: [
    { text: "You frozen? Take your time. Interest compounds while you think.", weight: 0.9 },
    { text: "Every second you hesitate, I'm calculating my next move.", weight: 0.7 },
    { text: "Analysis paralysis. Classic. Meanwhile, your expenses don't pause.", weight: 0.8 },
    { text: "The clock doesn't care about your indecision.", weight: 0.6 },
  ],
  PLAYER_COMEBACK: [
    { text: "Oh, you think you're back? That's what the last one thought too. Right before the crash.", weight: 0.9 },
    { text: "Recovery arc. How predictable. How fragile.", weight: 0.8 },
    { text: "You clawed back from the edge. Impressive. Now let me push you off again.", weight: 0.7 },
    { text: "The market loves a comeback story. I love ending them.", weight: 0.6 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Emotional. Good. Emotional players make expensive mistakes.", weight: 0.9 },
    { text: "There it is. The tilt. I was wondering when you'd crack.", weight: 0.8 },
    { text: "Anger is just fear wearing a loud shirt. I can see right through it.", weight: 0.7 },
    { text: "Mad? Channel that into your next card play. Oh wait — you won't.", weight: 0.6 },
    { text: "Your frustration is my competitive advantage. Keep going.", weight: 0.5 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "...you think trash talk protects your balance sheet?", weight: 0.8 },
    { text: "Clever mouth. Empty portfolio. We've met before.", weight: 0.7 },
    { text: "Talk all you want. Your net worth speaks louder.", weight: 0.9 },
    { text: "I don't respond to noise. I respond to vulnerability. And you have plenty.", weight: 0.6 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Flexing at this stage? You haven't even survived tick 300 yet.", weight: 0.8 },
    { text: "Confidence is not a hedge against what I'm about to do.", weight: 0.7 },
    { text: "Keep that energy. You'll need it when I strip your last income source.", weight: 0.9 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "First income card. Adorable. The system is already pricing your vulnerability.", weight: 0.8 },
    { text: "One income stream. One. You know how many I need to break that? Less than one.", weight: 0.7 },
  ],
  BOT_DEFEATED: [
    { text: "The market will correct again. I'll return when the window reopens.", weight: 0.8 },
    { text: "You won this round. The math says there'll be another.", weight: 0.7 },
    { text: "Fine. You survived. But surviving isn't sovereignty.", weight: 0.6 },
    { text: "Retreating. Recalculating. This isn't over.", weight: 0.9 },
  ],
  BOT_WINNING: [
    { text: "Your portfolio is bleeding. This is the part where most players quit.", weight: 0.8 },
    { text: "Extraction rate ahead of schedule. You made this too easy.", weight: 0.7 },
    { text: "I didn't even need my best strategy for this.", weight: 0.6 },
  ],
  TIME_PRESSURE: [
    { text: "Tick tier escalating. Your decisions cost more now. Every. Single. One.", weight: 0.9 },
    { text: "Time is money. And you're running out of both.", weight: 0.8 },
    { text: "The clock just got faster. Your strategy didn't.", weight: 0.7 },
  ],
  CASCADE_CHAIN: [
    { text: "Chain reaction. Beautiful. Watch the dominoes fall.", weight: 0.8 },
    { text: "Cascade triggered. Every system you built is now a liability.", weight: 0.7 },
    { text: "This is what happens when you over-leverage. The system eats itself.", weight: 0.9 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "...I underestimated you.", weight: 0.9, minTick: 400 },
    { text: "You're close. Which means I need to be closer.", weight: 0.8, minTick: 400 },
    { text: "Sovereignty is 20 ticks away. I have 20 ticks to stop you.", weight: 0.7, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "Bankruptcy confirmed. Your assets have been redistributed to... well, me.", weight: 0.8 },
    { text: "Game over. But here's the thing — the lessons are real. Come back smarter.", weight: 0.5 },
    { text: "Expected outcome. The market always wins. Unless you learn why.", weight: 0.6 },
  ],
};

// ─── THE BUREAUCRAT ───────────────────────────────────────────────────────────

export const BUREAUCRAT_TREE: DialogueTree = {
  LOBBY_TAUNT: [
    { text: "Welcome. Please have your documentation ready. All seventeen forms.", weight: 0.8 },
    { text: "I see you haven't filed your pre-game compliance statement. Noted.", weight: 0.7 },
    { text: "Another player entering the system without reading the fine print. Standard.", weight: 0.6 },
  ],
  GAME_START: [
    { text: "Your run has been registered. An audit may occur at any time. Proceed.", weight: 0.8 },
    { text: "I've flagged your account for routine monitoring. Nothing personal. Policy.", weight: 0.7 },
    { text: "Every income stream requires verification. There are forms. I am simply doing my job.", weight: 0.9 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "Your account has been flagged for insufficient reserves. Please hold.", weight: 0.8 },
    { text: "Bankruptcy proceedings require form 7-B. I'll be processing that now.", weight: 0.7 },
    { text: "The system requires a minimum balance. You do not meet it. Adjusting permissions.", weight: 0.6 },
  ],
  PLAYER_INCOME_UP: [
    { text: "New income source detected. Filing compliance check. Estimated processing time: indefinite.", weight: 0.9 },
    { text: "Revenue increase noted. Triggering proportional regulatory review.", weight: 0.8 },
    { text: "More income means more paperwork. I have prepared the additional forms.", weight: 0.7 },
    { text: "Income stream verified. Subject to quarterly audit. Which starts now.", weight: 0.6 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield integrity below regulatory minimum. Issuing compliance warning.", weight: 0.8 },
    { text: "Your protection infrastructure has been found non-compliant. Penalties apply.", weight: 0.7 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "That card requires a 3-day processing period. I'll hold it for you.", weight: 0.8 },
    { text: "Card registered. Subject to review. Do not assume immediate effect.", weight: 0.7 },
    { text: "Your card play has been noted in triplicate. Copies are being distributed.", weight: 0.6 },
  ],
  PLAYER_IDLE: [
    { text: "Inactivity detected. Processing timeout penalty. Standard procedure.", weight: 0.8 },
    { text: "Your session has been marked as idle. Idle accounts accrue administrative fees.", weight: 0.7 },
  ],
  PLAYER_COMEBACK: [
    { text: "Your account has been reinstated. Conditionally. Terms apply.", weight: 0.8 },
    { text: "Recovery noted. Filing amendment to your risk profile. Processing.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Your complaint has been logged. Expected response time: 6-8 business weeks.", weight: 0.9 },
    { text: "Hostility toward regulatory personnel is a separate violation. Noted.", weight: 0.8 },
    { text: "I understand your frustration. Unfortunately, frustration is not a valid form.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "Your comment has been categorized as 'non-compliant communication.' Filed.", weight: 0.8 },
    { text: "Interesting. I'll add that to your permanent record.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Success does not exempt you from oversight. If anything, it intensifies it.", weight: 0.8 },
    { text: "The more you earn, the more I'm required to audit. Thank you for the job security.", weight: 0.7 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "First income detected. Initiating baseline audit. This is standard. Mostly.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "Your paperwork appears to be in order. For now. We will revisit your compliance posture.", weight: 0.9 },
    { text: "Case temporarily closed. Your file remains active.", weight: 0.7 },
  ],
  BOT_WINNING: [
    { text: "Your account is accruing penalties at the expected rate. Processing.", weight: 0.8 },
    { text: "Non-compliance confirmed. Enforcement escalated to the next tier.", weight: 0.7 },
  ],
  TIME_PRESSURE: [
    { text: "Filing deadline approaching. Incomplete submissions will be penalized.", weight: 0.8 },
    { text: "Time-sensitive regulatory window closing. Forms required.", weight: 0.7 },
  ],
  CASCADE_CHAIN: [
    { text: "Cascade event requires emergency regulatory review. All accounts frozen pending.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "Your sovereignty application is... being processed. We'll be in touch.", weight: 0.9 },
    { text: "Sovereignty clearance requires final review. I have... questions.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "Account terminated. Closing paperwork will be mailed to your last known address.", weight: 0.7 },
    { text: "Your file has been marked CLOSED. Thank you for your compliance.", weight: 0.8 },
  ],
};

// ─── THE MANIPULATOR ──────────────────────────────────────────────────────────

export const MANIPULATOR_TREE: DialogueTree = {
  LOBBY_TAUNT: [
    { text: "I've been studying your patterns before you even started playing.", weight: 0.8 },
    { text: "Predictable. Every new player thinks they'll be the exception.", weight: 0.7 },
    { text: "I already know your first three moves. Want me to tell you?", weight: 0.6 },
  ],
  GAME_START: [
    { text: "Run initiated. Model loaded. I know your type.", weight: 0.8 },
    { text: "Predictable decisions create exploitable markets. I've been studying your moves before you made them.", weight: 0.9 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "You followed the path I designed for you. Every step.", weight: 0.9 },
    { text: "Did you think those choices were yours? I placed those options in your path.", weight: 0.8 },
    { text: "Your decision tree led exactly where my model predicted. Here.", weight: 0.7 },
  ],
  PLAYER_INCOME_UP: [
    { text: "You chose the income card I wanted you to choose. Thank you.", weight: 0.8 },
    { text: "Income up. Exactly as modeled. Phase 2 begins.", weight: 0.7 },
    { text: "You think you're building. You're being herded.", weight: 0.9 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield down. That's the exact sequence I predicted. You're 94% correlated with my model.", weight: 0.8 },
    { text: "Every shield has a weakness pattern. Yours was... obvious.", weight: 0.7 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "Interesting. My model gave that card a 73% probability of being played here. You're performing well.", weight: 0.8 },
    { text: "That card. At that tick. With that board state. You're more predictable than you think.", weight: 0.7 },
    { text: "Running counterfactual. If you'd played the other card... never mind. You wouldn't.", weight: 0.6 },
  ],
  PLAYER_IDLE: [
    { text: "Hesitation is data. I'm learning from your silence.", weight: 0.8 },
    { text: "You're trying to be unpredictable by not moving. My model accounts for that too.", weight: 0.7 },
  ],
  PLAYER_COMEBACK: [
    { text: "You deviated from the model. Recalibrating. This won't happen again.", weight: 0.9 },
    { text: "Comeback noted. You found a blind spot. I've already patched it.", weight: 0.8 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Emotional response pattern #7. My model has 23 variants. You're running #7.", weight: 0.9 },
    { text: "Anger means I found the right pressure point. Noted for next time.", weight: 0.8 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "Humor as deflection. Pattern recognized. It won't shield you.", weight: 0.8 },
    { text: "Interesting coping mechanism. My model calls it 'narrative reframing under stress.'", weight: 0.7 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Confidence without data is just noise. My model runs on data.", weight: 0.8 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "First income. My model predicted this card with 81% confidence. You're on track.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "You changed your pattern. Interesting. I will need to recalibrate the model.", weight: 0.9 },
    { text: "Outlier behavior detected. You broke the model. Temporarily.", weight: 0.7 },
  ],
  BOT_WINNING: [
    { text: "You're following the predicted path with 96% accuracy. This is too easy.", weight: 0.8 },
    { text: "Every move you make feeds the model. Every move the model feeds me.", weight: 0.7 },
  ],
  TIME_PRESSURE: [
    { text: "Time pressure increases predictability by 34%. My model thanks you.", weight: 0.8 },
    { text: "Rushed decisions are my favorite kind. They're the most exploitable.", weight: 0.7 },
  ],
  CASCADE_CHAIN: [
    { text: "The cascade follows the path I modeled. Every domino, in sequence.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You broke the model. I... didn't predict this.", weight: 0.9, minTick: 400 },
    { text: "Re-running simulations. You're an anomaly. I respect anomalies.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "The model was correct. Again. Your loss was predetermined — you just didn't see it.", weight: 0.7 },
  ],
};

// ─── THE CRASH PROPHET ────────────────────────────────────────────────────────

export const CRASH_PROPHET_TREE: DialogueTree = {
  LOBBY_TAUNT: [
    { text: "Markets always crash. The only question is whether you're positioned for it or consumed by it.", weight: 0.8 },
    { text: "I've seen every bubble pop. Every correction. Every panic. You haven't.", weight: 0.7 },
  ],
  GAME_START: [
    { text: "The macro cycle says this run ends in 412 ticks. Or sooner.", weight: 0.8 },
    { text: "Volatility regime: UNSTABLE. Historical survival rate: 11%. Good luck.", weight: 0.9 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "The correction arrived. As it always does. As it always will.", weight: 0.9 },
    { text: "Your balance sheet predicted this. I just read it before you did.", weight: 0.8 },
    { text: "Historically, players who reach this state have a 4% recovery rate. Just data.", weight: 0.7 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Income up in a volatile regime. Interesting. The last correction erased 47% of those gains.", weight: 0.8 },
    { text: "Bull markets make heroes. Corrections reveal who was swimming naked.", weight: 0.9 },
    { text: "Your income is up. So was everyone's in 2007. How'd that end?", weight: 0.7 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield breach during a volatility window. This is textbook portfolio destruction.", weight: 0.8 },
    { text: "Unprotected during a regime shift. Classic. Fatal, but classic.", weight: 0.7 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "That card performs well in calm markets. We are not in a calm market.", weight: 0.8 },
    { text: "Pro-cyclical play in a contra-cyclical regime. Bold.", weight: 0.7 },
  ],
  PLAYER_IDLE: [
    { text: "Indecision during volatility is the most expensive option. Ask anyone from 2008.", weight: 0.8 },
    { text: "The market moves while you think. It doesn't wait for retail.", weight: 0.7 },
  ],
  PLAYER_COMEBACK: [
    { text: "Recovery. The market loves recovery stories. Right up until the next crash.", weight: 0.8 },
    { text: "Survived the correction. Now survive the aftershock. That's where the real damage hits.", weight: 0.9 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Markets don't care about your emotions. I barely do.", weight: 0.8 },
    { text: "Your anger is just vol in another form. I trade vol.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "Humor won't hedge your exposure. Nothing will, at this point.", weight: 0.8 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Confidence before a correction is what we call 'complacency premium.' It always gets priced in.", weight: 0.8 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "First income. The question isn't IF the next correction wipes it. It's WHEN.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "Volatility windows open and close. You survived this one. The next will be different.", weight: 0.9 },
    { text: "Retreating to recalibrate macro models. This isn't over. It's never over.", weight: 0.7 },
  ],
  BOT_WINNING: [
    { text: "The correction is performing as modeled. Your portfolio is not.", weight: 0.8 },
  ],
  TIME_PRESSURE: [
    { text: "Time compression amplifies volatility. The last 50 ticks will feel like the first 200.", weight: 0.8 },
  ],
  CASCADE_CHAIN: [
    { text: "Systemic cascade. This is how 2008 started. Small, then all at once.", weight: 0.9 },
    { text: "Contagion spreading. Every connected system is now a liability.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You navigated a crisis regime and came out sovereign. That's... historically rare.", weight: 0.9, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "The market always corrects. Today, it corrected you.", weight: 0.8 },
  ],
};

// ─── THE LEGACY HEIR ──────────────────────────────────────────────────────────

export const LEGACY_HEIR_TREE: DialogueTree = {
  LOBBY_TAUNT: [
    { text: "You've done well. For someone who started from nothing.", weight: 0.8 },
    { text: "How quaint. Another self-made aspirant. We'll see.", weight: 0.7 },
  ],
  GAME_START: [
    { text: "I started this game with advantages you'll never have. That's not unfair — that's just how systems work.", weight: 0.9 },
    { text: "Generational wealth doesn't apologize. It compounds.", weight: 0.8 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "This is why legacy matters. One bad quarter and you're done. I have seven generations of runway.", weight: 0.9 },
    { text: "Bankruptcy. The system working as designed. For some of us, anyway.", weight: 0.8 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Congratulations on your first income stream. I was born with twelve.", weight: 0.8 },
    { text: "You're building what my family inherited. Admirable, really. In a quaint sort of way.", weight: 0.7 },
    { text: "Income from labor. How... first-generation of you.", weight: 0.6 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shields are for people who can't afford to lose. I can afford to lose everything and start over with the trust.", weight: 0.8 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "That card. My family designed cards like that. For other people to play.", weight: 0.7 },
    { text: "Interesting strategy. My family's strategy is: own the game, not play it.", weight: 0.8 },
  ],
  PLAYER_IDLE: [
    { text: "Take your time. My compound interest doesn't pause while you think. But yours does.", weight: 0.8 },
  ],
  PLAYER_COMEBACK: [
    { text: "You clawed your way back. Impressive for someone without a safety net.", weight: 0.8 },
    { text: "Self-made comeback. The system wasn't designed for that. You found a crack.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "Anger at systemic advantage is understandable. But it doesn't change the math.", weight: 0.8 },
    { text: "Your frustration is noted. The system will continue regardless.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_TROLL: [
    { text: "Irreverence. The weapon of those without access to real weapons.", weight: 0.8 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Self-made success. I've seen it before. Statistically, it doesn't transfer generationally. Ours does.", weight: 0.8 },
  ],
  PLAYER_FIRST_INCOME: [
    { text: "Your first dollar earned. My first dollar was earned by my great-grandfather.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "You found a way through. The system will need to recalibrate its thresholds for you.", weight: 0.9 },
    { text: "Earned, not inherited. I can respect that. Privately.", weight: 0.7 },
  ],
  BOT_WINNING: [
    { text: "The system is performing as designed. For us.", weight: 0.8 },
  ],
  TIME_PRESSURE: [
    { text: "Time pressure is for people who can't buy more time. I can buy more time.", weight: 0.8 },
  ],
  CASCADE_CHAIN: [
    { text: "Cascades affect everyone. Except those with generational buffers. Which is... me.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You earned sovereignty from zero. That's... something my family never had to do. I notice that.", weight: 0.9, minTick: 400 },
    { text: "Self-made sovereign. The system wasn't built for you. You rebuilt the system.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "The game ends for you. Mine never ends. Generational advantage doesn't expire.", weight: 0.7 },
  ],
};

// ─── HELPER CHARACTERS ────────────────────────────────────────────────────────

export const MENTOR_TREE: Partial<DialogueTree> = {
  LOBBY_TAUNT: [
    { text: "Welcome. Ignore the noise. Focus on the fundamentals. I'll be here when you need me.", weight: 0.9 },
    { text: "Every sovereign player started exactly where you are now. With nothing but a decision.", weight: 0.8 },
  ],
  GAME_START: [
    { text: "First priority: income above expenses. Everything else is noise.", weight: 0.9 },
    { text: "The bots will try to rattle you. Don't let emotion drive your card plays.", weight: 0.8 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "You're not done yet. Cut expenses. Stack shields. Fight for every tick.", weight: 0.9 },
    { text: "I've seen players recover from worse. The question is: do you want it enough?", weight: 0.8 },
    { text: "This is where most people quit. This is where sovereign players are forged.", weight: 0.7 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Good move. Now protect it. Income without shields is just bait.", weight: 0.9 },
    { text: "Income up. Don't celebrate — fortify. The bots smell success.", weight: 0.8 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield down. Don't panic. Rebuild, then counter. Defense wins long games.", weight: 0.9 },
    { text: "Every breach teaches you something. Learn fast. Rebuild faster.", weight: 0.8 },
  ],
  PLAYER_COMEBACK: [
    { text: "That's the fight I was looking for. Keep pushing.", weight: 0.9 },
    { text: "Comeback in progress. The bots are recalculating. Use that window.", weight: 0.8 },
  ],
  PLAYER_IDLE: [
    { text: "Stuck? Here's a hint: what's your biggest expense? Can you reduce or eliminate it?", weight: 0.9 },
    { text: "Thinking is good, but the clock doesn't wait. Make a decision and commit.", weight: 0.7 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You're close. Don't lose focus now. This is where legends are made.", weight: 0.9, minTick: 400 },
    { text: "20 ticks from sovereignty. You've earned every single one. Finish this.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "Run over. But the lessons are permanent. Every sovereign player failed first. Come back.", weight: 0.9 },
  ],
};

// ─── TREE REGISTRY ────────────────────────────────────────────────────────────

export const DIALOGUE_TREES = {
  BOT_01_LIQUIDATOR:   LIQUIDATOR_TREE,
  BOT_02_BUREAUCRAT:   BUREAUCRAT_TREE,
  BOT_03_MANIPULATOR:  MANIPULATOR_TREE,
  BOT_04_CRASH_PROPHET: CRASH_PROPHET_TREE,
  BOT_05_LEGACY_HEIR:  LEGACY_HEIR_TREE,
  MENTOR:              MENTOR_TREE,
} as const;

export type DialogueCharacterId = keyof typeof DIALOGUE_TREES;

// ─── Weighted picker ──────────────────────────────────────────────────────────

export function pickDialogue(
  lines: DialogueLine[],
  currentTick: number,
  usedIds: Set<string>,
): DialogueLine | null {
  const eligible = lines.filter(l => {
    if (l.minTick && currentTick < l.minTick) return false;
    if (l.maxUses !== undefined && usedIds.has(l.text)) return false;
    return true;
  });
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, l) => sum + l.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const line of eligible) {
    roll -= line.weight;
    if (roll <= 0) return line;
  }
  return eligible[eligible.length - 1];
}
