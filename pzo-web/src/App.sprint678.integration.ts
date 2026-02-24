/**
 * PZO SPRINT 6–8 INTEGRATION GUIDE
 * ══════════════════════════════════════════════════════════════════════════════
 * Drop-in integration for the 6 new files into your existing App.tsx.
 * Follow sections in order. Each section is surgical — no rewrites needed.
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — NEW IMPORTS (add to top of App.tsx)
// ─────────────────────────────────────────────────────────────────────────────
/*
import ProofCardV2, {
  computeScoring,
  type RunScoringInput,
  type KeyMoment,
} from './components/ProofCardV2';

import {
  MarketRowDisplay,
  InteractionPanel,
  ClubScoreboard,
  ModeratorPresetSelector,
} from './components/ClubUI';

import {
  LadderStandingsPanel,
  ReplayReportPanel,
  MatchExportCard,
  SeasonBadge,
  AchievementBadges,
} from './components/LeagueUI';

import {
  createClubSession,
  tickMarketRow,
  claimMarketCard,
  tickAiCompetition,
  buildAidCard,
  buildTradeCard,
  buildBlockCard,
  buildChallengeCard,
  buildAllianceCard,
  resolveInteraction,
  resolveChallenge,
  appendSessionAction,
  verifyActionLog,
} from './engine/clubEngine';

import {
  DEFAULT_RULE_PACK,
  buildRulePackHash,
  computeMatchHash,
  generateReplayReport,
  appendAction,
  type MatchResultSnapshot,
  type RulePack,
} from './engine/antiCheat';

import {
  initPlayerRecord,
  addRunToRecord,
  buildLadderStandings,
  buildClubStandings,
  createRunRecord,
  type RunRecord,
  type PlayerSeasonRecord,
} from './engine/seasonLadder';

import type {
  ClubSession,
  ModeratorPreset,
  ClubPlayer,
} from './types/club';
import { MODERATOR_RULE_SETS } from './types/club';
*/


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — NEW STATE ADDITIONS (add inside your main App component)
// ─────────────────────────────────────────────────────────────────────────────
/*
// ── Sprint 6 — ProofCard Scoring ──────────────────────────────────────────
const [keyMoments, setKeyMoments] = useState<KeyMoment[]>([]);
const [scoringInput, setScoringInput] = useState<RunScoringInput | null>(null);
const [runStats, setRunStats] = useState({
  totalFubarHits: 0,
  fubarsAbsorbed: 0,
  wasEverInDistress: false,
  recoveredFromDistress: false,
  bankruptcyTick: null as number | null,
  biasActivations: 0,
  biasesCleared: 0,
  wrongZonePlays: 0,
  correctZonePlays: 0,
  decisionFatigueEvents: 0,
  mitigationsUsed: 0,
  mitigationTypes: [] as string[],
  peakHubrisMeter: 0,
  hubrisEvents: 0,
  totalPlays: 0,
});

// ── Sprint 7 — Club Session ───────────────────────────────────────────────
const [clubSession, setClubSession] = useState<ClubSession | null>(null);
const [isClubMode, setIsClubMode] = useState(false);
const [selectedPreset, setSelectedPreset] = useState<ModeratorPreset>('OPEN_CLUB');
const [myPlayerId] = useState(() => `player-${Math.floor(Math.random() * 100000)}`);

// ── Sprint 8 — Anti-Cheat / League ───────────────────────────────────────
const [actionLog, setActionLog] = useState<import('./engine/antiCheat').SessionAction[]>([]);
const [matchHash, setMatchHash] = useState<string | null>(null);
const [replayReport, setReplayReport] = useState<import('./engine/antiCheat').ReplayReport | null>(null);
const [playerRecord, setPlayerRecord] = useState<PlayerSeasonRecord>(
  initPlayerRecord(myPlayerId, 'Player', '🃏', null)
);
const [showLeague, setShowLeague] = useState(false);
const rulePack: RulePack = DEFAULT_RULE_PACK;
*/


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — INSTRUMENT handlePlayCard (add inside existing handler)
// ─────────────────────────────────────────────────────────────────────────────
/*
// Inside your existing handlePlayCard function, AFTER resolving card effects,
// add these calls:

// 3a. Log action for anti-cheat
setActionLog(prev => appendAction(prev, tick, myPlayerId, 'card_played', {
  cardId: card.id,
  zoneId,
  cashBefore: cash,
  netWorthBefore: netWorth,
}));

// 3b. Track key moment if significant
const isDeltaSignificant = Math.abs(cashDelta) > 2000 || Math.abs(cashflowDelta) > 500;
if (isDeltaSignificant) {
  setKeyMoments(prev => [...prev, {
    tick,
    type: card.type === 'FUBAR' ? 'fubar' : card.type === 'OPPORTUNITY' ? 'play' : 'play',
    label: card.name,
    cashDelta,
    cashflowDelta,
    explanation: explanation ?? `${card.name} played in ${zoneId} zone.`,
  }].slice(-20)); // keep last 20 moments
}

// 3c. Update run stats
setRunStats(prev => ({
  ...prev,
  totalPlays: prev.totalPlays + 1,
  totalFubarHits: card.type === 'FUBAR' ? prev.totalFubarHits + 1 : prev.totalFubarHits,
  fubarsAbsorbed: (card.type === 'FUBAR' && shieldsUsed > 0) ? prev.fubarsAbsorbed + 1 : prev.fubarsAbsorbed,
  correctZonePlays: isCompatibleZone ? prev.correctZonePlays + 1 : prev.correctZonePlays,
  wrongZonePlays: !isCompatibleZone ? prev.wrongZonePlays + 1 : prev.wrongZonePlays,
  peakHubrisMeter: Math.max(prev.peakHubrisMeter, runState.mindState?.hubrisMeter ?? 0),
}));
*/


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — HOOK INTO DISTRESS DETECTION (add inside monthly tick logic)
// ─────────────────────────────────────────────────────────────────────────────
/*
// Inside your MONTH_TICKS branch, after processing obligations:

const isDistressNow = runState.isInDistressNow;

if (isDistressNow && !runStats.wasEverInDistress) {
  setRunStats(prev => ({ ...prev, wasEverInDistress: true }));
  setKeyMoments(prev => [...prev, {
    tick,
    type: 'fubar',
    label: 'Entered Distress',
    cashDelta: 0,
    cashflowDelta: 0,
    explanation: 'Liquidity dropped below threshold. Recovery window opened.',
  }]);
}

if (!isDistressNow && runStats.wasEverInDistress && !runStats.recoveredFromDistress) {
  setRunStats(prev => ({ ...prev, recoveredFromDistress: true }));
  setKeyMoments(prev => [...prev, {
    tick,
    type: 'recovery',
    label: 'Recovered from Distress',
    cashDelta: 0,
    cashflowDelta: 0,
    explanation: 'Liquidity restored above threshold. System stabilized.',
  }]);
}
*/


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — END RUN HANDLER (replace or extend existing endRun logic)
// ─────────────────────────────────────────────────────────────────────────────
/*
function handleEndRun() {
  // 5a. Build scoring input
  const finalIncome = cashflow > 0 ? cashflow : 0;
  const finalExpenses = monthlyObligations;
  
  const input: RunScoringInput = {
    finalCash: cash,
    finalNetWorth: netWorth,
    finalIncome,
    finalExpenses,
    startingCash: STARTING_CASH,
    totalFubarHits: runStats.totalFubarHits,
    fubarsAbsorbed: runStats.fubarsAbsorbed,
    wasEverInDistress: runStats.wasEverInDistress,
    recoveredFromDistress: runStats.recoveredFromDistress,
    bankruptcyTick: runStats.bankruptcyTick,
    biasActivations: runStats.biasActivations,
    biasesCleared: runStats.biasesCleared,
    wrongZonePlays: runStats.wrongZonePlays,
    correctZonePlays: runStats.correctZonePlays,
    obligationCoverage: runState.balanceSheet ? runState.balanceSheet.obligationCoverage : 1,
    decisionFatigueEvents: runStats.decisionFatigueEvents,
    mitigationsUsed: runStats.mitigationsUsed,
    mitigationTypes: runStats.mitigationTypes,
    finalHhi: runState.portfolio ? computeConcentrationScore(runState.portfolio) : 0,
    peakHubrisMeter: runStats.peakHubrisMeter,
    hubrisEvents: runStats.hubrisEvents,
    totalTicks: tick,
    totalPlays: runStats.totalPlays,
    objectives: runState.objectives ?? [],
    completedObjectives: runState.completedObjectives ?? [],
    capabilities: runState.capabilities,
    reputation: runState.reputation,
    portfolio: runState.portfolio ?? [],
    keyMoments,
    runSeed: seed,
    difficultyPreset: difficulty,
  };
  setScoringInput(input);
  
  // 5b. Compute scoring
  const scoring = computeScoring(input);
  
  // 5c. Compute match hash
  const logTail = actionLog.length > 0 ? actionLog[actionLog.length - 1].hash : '00000000';
  const snapshot: MatchResultSnapshot = {
    runSeed: seed,
    rulePackHash: rulePack.hash ?? '',
    playerId: myPlayerId,
    finalCash: cash,
    finalNetWorth: netWorth,
    finalIncome,
    finalExpenses,
    totalPlays: runStats.totalPlays,
    totalFubarHits: runStats.totalFubarHits,
    survivedRun: runStats.bankruptcyTick === null,
    completedObjectiveIds: runState.completedObjectives?.map(o => String(o)) ?? [],
    totalScore: scoring.totalScore,
    grade: scoring.grade,
    endTick: tick,
    actionLogTailHash: logTail,
  };
  const hash = computeMatchHash(snapshot);
  setMatchHash(hash);
  
  // 5d. Generate replay report
  const report = generateReplayReport(snapshot, actionLog, rulePack);
  setReplayReport(report);
  
  // 5e. Save run record to player record
  const runRecord = createRunRecord(
    `run-${seed}-${tick}`,
    myPlayerId,
    clubSession?.sessionId ?? null,
    hash,
    rulePack.hash ?? '',
    scoring,
    { cash, netWorth, income: finalIncome, expenses: finalExpenses },
    {
      difficultyPreset: difficulty,
      survivedRun: runStats.bankruptcyTick === null,
      completedObjectiveIds: runState.completedObjectives?.map(o => String(o)) ?? [],
      totalPlays: runStats.totalPlays,
      verified: report.verdict === 'CLEAN',
      grade: scoring.grade,
    }
  );
  setPlayerRecord(prev => addRunToRecord(prev, runRecord, {
    seasonId: 'season-1',
    name: 'Season 1',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    format: 'open',
    maxRunsPerPeriod: 10,
    scoringMode: 'best_run',
    rulePackHash: rulePack.hash ?? '',
    allowedPresets: ['INTRO', 'STANDARD', 'BRUTAL'],
    tiebreaker: 'net_worth',
  }));
  
  // 5f. Transition to proof screen
  setScreen('proof');
}
*/


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — CLUB SESSION WIRING
// ─────────────────────────────────────────────────────────────────────────────
/*
// Start a club session (called when entering club mode)
function handleStartClubSession() {
  const session = createClubSession(
    `session-${Date.now()}`,
    'PZO Club',
    myPlayerId,
    selectedPreset,
    Math.floor(Math.random() * 999999),
  );
  setClubSession(session);
  setIsClubMode(true);
}

// Tick market row each month
function tickClubSystems() {
  if (!clubSession) return;
  
  // Get current card pool (your existing drawn cards + deck)
  const cardPool = [...hand, ...deck];
  
  const { newState: newMarket, spawned, expired } = tickMarketRow(
    clubSession.marketRow,
    tick,
    cardPool,
    clubSession.sessionSeed,
  );
  
  // AI competition
  const { newState: afterAi, aiClaims } = tickAiCompetition(newMarket, tick, clubSession.sessionSeed);
  
  if (aiClaims.length > 0) {
    addLog(`🤖 AI competitor claimed: ${aiClaims.join(', ')}`);
  }
  
  setClubSession(prev => prev ? {
    ...prev,
    marketRow: afterAi,
    currentTick: tick,
  } : null);
}

// Claim market card
function handleClaimMarketCard(marketCardId: string) {
  if (!clubSession) return;
  const { success, newState, reason } = claimMarketCard(
    clubSession.marketRow,
    marketCardId,
    myPlayerId,
    cash,
    tick,
  );
  if (success) {
    // Log action for anti-cheat
    setActionLog(prev => appendAction(prev, tick, myPlayerId, 'market_claim', { marketCardId }));
    setClubSession(prev => prev ? { ...prev, marketRow: newState } : null);
    // Add the claimed card to hand (find it from the market row)
    const slot = clubSession.marketRow.slots.find(s => s.id === marketCardId);
    if (slot) addCardToHand(slot.card);
    setCash(c => c - (slot?.minBidCash ?? slot?.card.energyCost ?? 0));
    addLog(`✅ Market card claimed: ${clubSession.marketRow.slots.find(s => s.id === marketCardId)?.card.name}`);
  } else {
    addLog(`❌ Cannot claim: ${reason}`);
  }
}

// Send interaction card
function handleSendAid(targetId: string, amount: number, aidType: string) {
  if (!clubSession) return;
  const interaction = buildAidCard(myPlayerId, targetId, amount, aidType as any, 60, tick);
  setClubSession(prev => prev ? {
    ...prev,
    pendingInteractions: [...prev.pendingInteractions, interaction],
    actionLog: appendSessionAction(prev.actionLog, tick, myPlayerId, 'aid_sent', { targetId, amount, aidType }),
  } : null);
}

function handleAcceptInteraction(interactionId: string) {
  if (!clubSession) return;
  const interaction = clubSession.pendingInteractions.find(i => i.id === interactionId);
  if (!interaction) return;
  
  const result = resolveInteraction(interaction, true, tick);
  
  setCash(c => c + result.sourceCashDelta);
  // Apply reputation delta (use your existing reputation update call)
  
  setClubSession(prev => prev ? {
    ...prev,
    pendingInteractions: prev.pendingInteractions.map(i =>
      i.id === interactionId ? { ...i, status: 'accepted', resolvedAtTick: tick } : i
    ),
    resolvedInteractions: [...prev.resolvedInteractions, { ...interaction, status: 'accepted' }],
    actionLog: appendSessionAction(prev.actionLog, tick, myPlayerId, 'interaction_accepted', { interactionId }),
  } : null);
  addLog(result.logEntry);
}
*/


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — JSX ADDITIONS (add to run screen and proof screen)
// ─────────────────────────────────────────────────────────────────────────────
/*
// ── In the Run Screen (below existing panels): ────────────────────────────

{isClubMode && clubSession && (
  <>
    <MarketRowDisplay
      marketRow={clubSession.marketRow}
      currentTick={tick}
      playerCash={cash}
      playerId={myPlayerId}
      onClaim={handleClaimMarketCard}
      onBid={(id, amount) => console.log('bid', id, amount)}
    />
    
    <InteractionPanel
      players={clubSession.players}
      myPlayerId={myPlayerId}
      pendingInteractions={clubSession.pendingInteractions}
      ruleSet={clubSession.ruleSet}
      onSendAid={handleSendAid}
      onSendTrade={(targetId) => console.log('trade', targetId)}
      onSendBlock={(tId, mId) => console.log('block', tId, mId)}
      onSendChallenge={(tId, type) => console.log('challenge', tId, type)}
      onSendAlliance={(tId, type) => console.log('alliance', tId, type)}
      onAcceptInteraction={handleAcceptInteraction}
      onRejectInteraction={(id) => handleAcceptInteraction(id)} // pass false for reject
    />
    
    <ClubScoreboard
      players={clubSession.players}
      myPlayerId={myPlayerId}
      currentTick={tick}
    />
  </>
)}


// ── In the Proof Screen (REPLACE old ProofCard with): ────────────────────

{scoringInput && (
  <ProofCardV2
    input={scoringInput}
    matchHash={matchHash ?? undefined}
    onRestart={handleRestart}
    onShare={(tag) => {
      navigator.clipboard.writeText(tag);
      addLog('Proof tag copied!');
    }}
    onExport={() => setShowExportCard(true)}
  />
)}

{replayReport && (
  <ReplayReportPanel
    report={replayReport}
    onDismiss={() => setReplayReport(null)}
  />
)}

{matchHash && scoringInput && (
  <MatchExportCard
    run={{
      runId: `run-${seed}`,
      playerId: myPlayerId,
      clubId: null,
      matchHash,
      rulePackHash: rulePack.hash ?? '',
      timestamp: Date.now(),
      totalScore: computeScoring(scoringInput).totalScore,
      grade: computeScoring(scoringInput).grade,
      moneyScore: computeScoring(scoringInput).moneyScore,
      resilienceScore: computeScoring(scoringInput).resilienceScore,
      disciplineScore: computeScoring(scoringInput).disciplineScore,
      riskMgmtScore: computeScoring(scoringInput).riskMgmtScore,
      objectiveBonus: computeScoring(scoringInput).objectiveBonus,
      difficultyMultiplier: computeScoring(scoringInput).difficultyMultiplier,
      finalCash: scoringInput.finalCash,
      finalNetWorth: scoringInput.finalNetWorth,
      finalIncome: scoringInput.finalIncome,
      finalExpenses: scoringInput.finalExpenses,
      difficultyPreset: scoringInput.difficultyPreset,
      survivedRun: scoringInput.bankruptcyTick === null,
      completedObjectiveIds: scoringInput.completedObjectives.map(String),
      totalPlays: scoringInput.totalPlays,
      verified: replayReport.verdict === 'CLEAN',
    }}
    matchHash={matchHash}
    playerName="You"
    seasonName="Season 1"
    ladderRank={playerRecord.ladderRank}
    onCopyText={() => addLog('Match proof copied to clipboard')}
  />
)}


// ── Season / League button (add to main menu or proof screen): ───────────

{showLeague && (
  <LadderStandingsPanel
    entries={buildLadderStandings([playerRecord], {
      seasonId: 'season-1',
      name: 'Season 1',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      format: 'open',
      maxRunsPerPeriod: 10,
      scoringMode: 'best_run',
      rulePackHash: rulePack.hash ?? '',
      allowedPresets: ['INTRO', 'STANDARD', 'BRUTAL'],
      tiebreaker: 'net_worth',
    })}
    myPlayerId={myPlayerId}
    seasonName="Season 1"
    format="Open"
  />
)}

{playerRecord.achievements.length > 0 && (
  <AchievementBadges achievements={playerRecord.achievements} />
)}
*/


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — RESET (extend existing handleRestart)
// ─────────────────────────────────────────────────────────────────────────────
/*
// Add to your existing restart function:
setKeyMoments([]);
setScoringInput(null);
setMatchHash(null);
setReplayReport(null);
setActionLog([]);
setRunStats({
  totalFubarHits: 0, fubarsAbsorbed: 0,
  wasEverInDistress: false, recoveredFromDistress: false,
  bankruptcyTick: null, biasActivations: 0, biasesCleared: 0,
  wrongZonePlays: 0, correctZonePlays: 0,
  decisionFatigueEvents: 0, mitigationsUsed: 0,
  mitigationTypes: [], peakHubrisMeter: 0,
  hubrisEvents: 0, totalPlays: 0,
});
*/


// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────
/*
  □ src/components/ProofCardV2.tsx        — Sprint 6 scoring decomposition
  □ src/types/club.ts                     — Sprint 7 club type system
  □ src/engine/clubEngine.ts              — Sprint 7 market + interaction logic
  □ src/components/ClubUI.tsx             — Sprint 7 market row + interaction UI
  □ src/engine/antiCheat.ts              — Sprint 8 replay + hash + verification
  □ src/engine/seasonLadder.ts           — Sprint 8 ELO + standings + records
  □ src/components/LeagueUI.tsx          — Sprint 8 ladder + export + badges
  □ App.tsx — add imports per Section 1
  □ App.tsx — add state per Section 2
  □ handlePlayCard — instrument per Section 3
  □ monthlyTick — instrument per Section 4
  □ handleEndRun — build per Section 5
  □ Club handlers — wire per Section 6
  □ JSX — add panels per Section 7
  □ handleRestart — extend per Section 8
  
  TEST ORDER:
  1. Solo STANDARD run → ProofCardV2 renders with 4 pillars
  2. Verify matchHash generates at run end
  3. ReplayReportPanel shows CLEAN for legitimate run
  4. Enable club mode → MarketRow renders with cards
  5. Send Aid interaction → resolves with rep delta
  6. Check LadderStandingsPanel shows player entry
  7. AchievementBadges appear after qualifying run
*/

export {};
