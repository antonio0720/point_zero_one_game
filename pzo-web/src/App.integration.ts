/**
 * PZO UPGRADE — App.tsx INTEGRATION PATCH
 * 
 * This file shows EXACTLY what to add/change in your existing App.tsx.
 * Each section is labeled with: ADD, REPLACE, or WIRE.
 * 
 * All new logic is additive — your existing run loop stays intact.
 * The resolver replaces the inline effect logic inside handlePlayCard.
 */

// ─── 1. ADD: New imports at top of App.tsx ────────────────────────────────────
/*
import { useRunState } from './hooks/useRunState';
import { resolveCardEffects, checkMaintenanceEvents } from './engine/resolver';
import type { ZoneId, CardExtension } from './types/game';
import { OBJECTIVE_CONFIGS, DIFFICULTY_PROFILES } from './types/game';
import DistressRecovery from './components/DistressRecovery';
import BalanceSheetPanel from './components/BalanceSheetPanel';
import CapabilitiesPanel from './components/CapabilitiesPanel';
import type { ObjectiveId } from './types/game';
*/

// ─── 2. ADD: Inside App() function, after existing state declarations ─────────
/*
  const runState = useRunState(STARTING_CASH);

  // Difficulty selection (add to landing screen)
  const [selectedDifficulty, setSelectedDifficulty] = useState<'INTRO' | 'STANDARD' | 'BRUTAL'>('STANDARD');

  // Objectives: randomly pick 2 per run
  const [runObjectives, setRunObjectives] = useState<ObjectiveId[]>(['SURVIVE_12_MONTHS', 'CASHFLOW_POSITIVE']);

  // Distress recovery modal
  const [showDistressRecovery, setShowDistressRecovery] = useState(false);

  // Balance sheet + capabilities panels
  const [balanceSheetExpanded, setBalanceSheetExpanded] = useState(false);
  const [capabilitiesExpanded, setCapabilitiesExpanded] = useState(false);
*/

// ─── 3. ADD: Run start hook (add inside startRun() or your run init logic) ───
/*
  function startRun() {
    runState.resetRunState(STARTING_CASH);
    runState.setDifficulty(selectedDifficulty);

    // Pick 2 random objectives
    const allObjectiveIds = Object.keys(OBJECTIVE_CONFIGS) as ObjectiveId[];
    const shuffled = allObjectiveIds.sort(() => Math.random() - 0.5);
    setRunObjectives(shuffled.slice(0, 2));

    // ... rest of existing startRun logic
  }
*/

// ─── 4. REPLACE: handlePlayCard — full replacement ────────────────────────────
/*
  const handlePlayCard = useCallback((cardId: string, zoneAndTerms: string) => {
    if (screen !== 'run' || freezeTicks > 0) return;

    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex < 0) return;
    const card = hand[cardIndex];
    if (!card) return;

    // Parse zone and optional terms from encoded string (e.g. "BUILD|{...terms}")
    const [zoneStr, termsJson] = zoneAndTerms.split('|');
    const zone = (zoneStr as ZoneId) || 'BUILD';
    const terms: CardExtension['terms'] = termsJson ? JSON.parse(termsJson) : null;

    // Remove card from hand
    setHand(prev => prev.filter(c => c.id !== cardId));

    // ── Build resolver context ─────────────────────────────────────────────
    const resolverContext = {
      cardId: card.id,
      effects: card.extension?.effects ?? buildLegacyEffects(card), // convert legacy cards
      cardExtension: card.extension ?? null,
      zone,
      tick,
      cash,
      income: cashflowMonthly,
      expenses: STARTING_EXPENSES,
      balanceSheet: runState.balanceSheet,
      shields,
      mitigations: runState.mitigations,
      mindState: runState.mindState,
      reputation: runState.reputation,
      capabilities: runState.capabilities,
      portfolio: runState.portfolio,
      difficultyProfile: runState.difficultyProfile,
      regime,
      winStreak: season.winStreak,
    };

    // ── Resolve ────────────────────────────────────────────────────────────
    const result = resolveCardEffects(resolverContext);

    // ── Apply to legacy state (maintain backwards compat) ─────────────────
    if (result.cashDelta !== 0) {
      setCash(prev => prev + result.cashDelta - card.energyCost);
    }
    if (result.cashflowDelta !== 0) {
      setCashflowMonthly(prev => prev + result.cashflowDelta);
    }
    if (result.netWorthDelta !== 0) {
      setNetWorth(prev => prev + result.netWorthDelta);
    }
    if (result.freezeTicksDelta > 0) {
      setFreezeTicks(prev => prev + result.freezeTicksDelta);
    }
    if (result.shieldConsumed) {
      setShields(prev => Math.max(0, prev - 1));
    }

    // ── Apply to new state slices ──────────────────────────────────────────
    const sliceLogs = runState.applyResolutionResult(
      result,
      {
        id: card.id,
        assetClass: card.extension?.assetClass ?? inferAssetClassFromCard(card),
        cashflowMonthly: card.cashflowMonthly,
        zone,
        value: card.value,
        energyCost: card.energyCost,
      },
      tick,
    );

    // ── Log with explanation (the "teach back" layer) ─────────────────────
    const logMsg = `[T${tick}] ${card.name} → ${zone}: ${result.explanation}`;
    addLog(logMsg);
    for (const l of sliceLogs.filter(l => l !== result.explanation)) {
      addLog(`  ↳ ${l}`);
    }

    // ── Moment Flash for big events ────────────────────────────────────────
    if (result.biasStateSet) {
      setMomentFlash({ type: 'BIAS', label: `${result.biasStateSet} TRIGGERED`, color: 'orange' });
    }
    if (result.shieldConsumed) {
      setMomentFlash({ type: 'SHIELD', label: 'Shield Absorbed Hit', color: 'blue' });
    }
    if (result.capabilityGained) {
      setMomentFlash({ type: 'CAPABILITY', label: `+${result.capabilityGained.stat.toUpperCase()}`, color: 'purple' });
    }

    // ── Distress check ─────────────────────────────────────────────────────
    if (runState.isInDistressNow && !showDistressRecovery) {
      setTimeout(() => setShowDistressRecovery(true), 500); // slight delay for drama
    }

    // ── Telemetry ─────────────────────────────────────────────────────────
    emitTelemetry({
      tick,
      type: 'card_played',
      payload: {
        cardId: card.id,
        cardType: card.type,
        zone,
        cashflowDelta: result.cashflowDelta,
        cashDelta: result.cashDelta,
        explanation: result.explanation,
        zoneModifier: result.zoneModifierLabel ?? '',
      },
    });
  }, [screen, hand, tick, cash, cashflowMonthly, shields, freezeTicks, regime, season, runState, showDistressRecovery]);
*/

// ─── 5. ADD: Inside monthly tick handler (where MONTH_TICKS fires) ────────────
/*
  // Add this inside your existing tick-based useEffect, inside the MONTH_TICKS branch:
  
  if (tick % MONTH_TICKS === 0) {
    // ... existing monthly logic ...

    // NEW: Monthly obligations + bias expiry
    const monthlyLogs = runState.tickMonth(cashflowMonthly, tick);
    for (const l of monthlyLogs) addLog(`  ↳ ${l}`);

    // NEW: Check pending maturities
    const maturingNow = runState.checkMaturities(tick);
    for (const maturity of maturingNow) {
      addLog(`[T${tick}] 💰 ${maturity.label} — matured!`);
      setMomentFlash({ type: 'MATURITY', label: maturity.label, color: 'emerald' });
      // Re-resolve the matured effects
      const matCtx = { ...resolverBaseContext, effects: maturity.effects, cardId: maturity.sourceCardId };
      const matResult = resolveCardEffects(matCtx);
      setCash(prev => prev + matResult.cashDelta);
      setCashflowMonthly(prev => prev + matResult.cashflowDelta);
    }

    // NEW: Maintenance events
    const maintenanceEvents = checkMaintenanceEvents(
      runState.portfolio,
      tick,
      runState.capabilities,
      runState.difficultyProfile,
    );
    for (const evt of maintenanceEvents) {
      setCash(prev => prev - evt.cost);
      addLog(`[T${tick}] 🔧 ${evt.explanation}`);
    }

    // NEW: Update balance sheet cash sync
    runState.balanceSheet.cash = cash; // sync legacy cash to balance sheet
  }
*/

// ─── 6. ADD: JSX — wire new UI components into the run screen layout ──────────
/*
  // Inside your run screen JSX, add these panels after HUD / alongside GameBoard:
  
  <BalanceSheetPanel
    balanceSheet={runState.balanceSheet}
    obligations={runState.obligations}
    portfolio={runState.portfolio}
    mitigations={runState.mitigations}
    income={cashflowMonthly}
    isExpanded={balanceSheetExpanded}
    onToggle={() => setBalanceSheetExpanded(v => !v)}
  />

  <CapabilitiesPanel
    capabilities={runState.capabilities}
    reputation={runState.reputation}
    objectives={runObjectives}
    gameStateSnapshot={{
      cash,
      netWorth,
      income: cashflowMonthly,
      expenses: STARTING_EXPENSES,
      balanceSheet: runState.balanceSheet,
      portfolio: runState.portfolio,
      capabilities: runState.capabilities,
      reputation: runState.reputation,
      tick,
      wasEverInDistress: runState.wasEverInDistress,
    }}
    isExpanded={capabilitiesExpanded}
    onToggle={() => setCapabilitiesExpanded(v => !v)}
  />

  {showDistressRecovery && runState.isInDistressNow && (
    <DistressRecovery
      actions={runState.availableRecoveryActions}
      coverageRatio={runState.balanceSheet.obligationCoverage}
      liquidityPct={liquidityRatio(runState.balanceSheet)}
      onSelectAction={(action) => {
        const logs = runState.applyRecoveryAction(action);
        for (const l of logs) addLog(`[T${tick}] 🔄 ${l}`);
        setShowDistressRecovery(false);
        setMomentFlash({ type: 'RECOVERY', label: action.label, color: 'yellow' });
      }}
      onDismiss={() => setShowDistressRecovery(false)}
    />
  )}
*/

// ─── 7. ADD: Update CardHand props in JSX ────────────────────────────────────
/*
  // Replace your existing <CardHand /> call with:
  <CardHand
    cards={hand}
    playerEnergy={cash}
    onPlayCard={handlePlayCard}
    onCardHover={handleCardHover}
    currentTick={tick}
    activeBiases={runState.mindState.activeBiases as Record<string, {intensity: number}>}
  />
*/

// ─── 8. ADD: Legacy card → effect converter (wire legacy cards into resolver) ──
/*
  function buildLegacyEffects(card: Card): CardEffect[] {
    const effects: CardEffect[] = [];

    if (card.type === 'OPPORTUNITY' || card.type === 'IPA') {
      if (card.cashflowMonthly) {
        effects.push({ type: 'ADD_CASHFLOW', amount: card.cashflowMonthly, label: `+${card.cashflowMonthly}/mo cashflow` });
      }
      if (card.value) {
        effects.push({ type: 'ADD_ASSET_VALUE', amount: card.value });
      }
    }

    if (card.type === 'FUBAR') {
      effects.push({
        type: 'APPLY_DAMAGE',
        amount: Math.abs(card.cashImpact ?? 5000),
        damageType: 'macro',
        label: `FUBAR: −${Math.abs(card.cashImpact ?? 5000)}`,
      });
    }

    if (card.type === 'MISSED_OPPORTUNITY') {
      effects.push({ type: 'FREEZE_TICKS', amount: (card.turnsLost ?? 1) * 6, label: `Frozen: ${card.turnsLost} turns` });
    }

    if (card.type === 'PRIVILEGED') {
      if (card.value) {
        effects.push({ type: 'ADD_ASSET_VALUE', amount: card.value });
      }
      effects.push({ type: 'MODIFY_REPUTATION', amount: 15 });
    }

    if (card.type === 'SO') {
      // Obstacle resolved: small reward
      effects.push({ type: 'MODIFY_REPUTATION', amount: 10 });
    }

    return effects;
  }

  function inferAssetClassFromCard(card: Card): AssetClass {
    const sub = (card.subtype ?? '').toLowerCase();
    if (sub.includes('real estate') || sub.includes('rental')) return 'real_estate';
    if (sub.includes('digital') || sub.includes('saas') || sub.includes('business')) return 'digital';
    if (sub.includes('equit') || sub.includes('dividend') || sub.includes('stock')) return 'equities';
    if (sub.includes('capital') || sub.includes('meta') || sub.includes('skill')) return 'skills';
    if (sub.includes('network') || sub.includes('social')) return 'network';
    if (sub.includes('specul') || sub.includes('arena')) return 'speculative';
    return 'digital'; // default
  }
*/

// ─── 9. ADD: Difficulty selector on landing screen ───────────────────────────
/*
  // In your landing / start screen JSX, add:
  <div className="flex gap-3 justify-center mt-4">
    {(['INTRO', 'STANDARD', 'BRUTAL'] as const).map(preset => (
      <button
        key={preset}
        onClick={() => setSelectedDifficulty(preset)}
        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
          selectedDifficulty === preset
            ? 'bg-indigo-600 border-indigo-400 text-white'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
        }`}
      >
        {preset === 'INTRO' ? '📚 Intro' : preset === 'STANDARD' ? '⚙️ Standard' : '💀 Brutal'}
      </button>
    ))}
  </div>
  <p className="text-zinc-500 text-xs text-center mt-1">
    {selectedDifficulty === 'INTRO' ? 'Cleaner signals, gentler penalties. Good for learning.' :
     selectedDifficulty === 'BRUTAL' ? 'Tight liquidity, harsh counterparties, fast decay. No mercy.' :
     'Full simulation. All systems active.'}
  </p>
*/

// ─── 10. ADD: ProofCard enhancement — add new fields to end-of-run proof ─────
/*
  // Pass these additional fields to ProofCard:
  
  <ProofCard
    // ... existing props ...
    objectives={runObjectives}
    objectivesCompleted={runObjectives.filter(id => OBJECTIVE_CONFIGS[id].checkFn(gameSnap))}
    capabilities={runState.capabilities}
    reputation={runState.reputation}
    totalAssets={runState.portfolio.length}
    obligationsCarried={runState.obligations.length}
    wasEverInDistress={runState.wasEverInDistress}
    disciplineScore={runState.mindState.disciplineScore}
    hubrisPeak={peakHubris} // track peak hubris separately
  />
*/

export {};
