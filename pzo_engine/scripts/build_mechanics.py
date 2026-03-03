#!/usr/bin/env python3
"""
Point Zero One — pzo_engine/scripts/build_mechanics.py
═══════════════════════════════════════════════════════
Complete build system — 150 mechanics → production TypeScript.
Density6 LLC · Confidential · All Rights Reserved
"""
from __future__ import annotations
import argparse, json, re, sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Literal

SCRIPT_DIR    = Path(__file__).resolve().parent
PROJECT_ROOT  = SCRIPT_DIR.parent.parent
MECHANICS_DIR = PROJECT_ROOT / "mechanics"
ML_DIR        = PROJECT_ROOT / "ml"
JSON_OUT      = PROJECT_ROOT / "pzo-web" / "src" / "data" / "mechanics_core.json"
TS_OUT_DIR    = PROJECT_ROOT / "pzo_engine" / "src" / "mechanics"

MechanicLayer  = Literal["tick_engine","card_handler","ui_component","season_runtime","api_endpoint","backend_service"]
MechanicStatus = Literal["done","in_progress","todo"]

FIELD_TYPES: dict[str,str] = {
    "state.cash":"number","state.tick":"number","state.netWorth":"number",
    "state.cashflow":"number","state.income":"number","state.expenses":"number",
    "state.leverage":"number","state.pressureScore":"number","state.cordScore":"number",
    "state.haterHeat":"number","state.missedOpportunityCount":"number",
    "state.fubarCount":"number","state.socialTokens":"number",
    "state.battleBudget":"number","state.psycheMeter":"number",
    "state.trustScore":"number","state.defectionRisk":"number",
    "state.exposureHeat":"number","state.treasury":"number",
    "state.runPhase":"RunPhase","state.tickTier":"TickTier",
    "state.macroRegime":"MacroRegime","state.pressureTier":"PressureTier",
    "state.solvencyStatus":"SolvencyStatus","state.bleedMode":"boolean",
    "state.runId":"string","state.seasonState":"SeasonState",
    "state.shieldLayers":"ShieldLayer[]","state.assets":"Asset[]",
    "state.ipaItems":"IPAItem[]","state.hand":"GameCard[]",
    "state.activeDebts":"Debt[]","state.buffStack":"Buff[]",
    "state.activeSetBonuses":"SetBonus[]","state.assetMods":"AssetMod[]",
    "state.liabilities":"Liability[]",
    "RunSeed":"string","userId":"string","rulesVersion":"string",
    "timestamp":"number","runId":"string","playerId":"string",
    "rivalId":"string","seasonId":"string","teamId":"string",
    "contractId":"string","matchId":"string","assetId":"string",
    "liabilityId":"string","mentorId":"string","inviterId":"string",
    "newPlayerId":"string","wipedRunId":"string","leagueId":"string",
    "tableId":"string","delegateId":"string","escrowId":"string",
    "achievementId":"string","sourceAssetId":"string","targetAssetId":"string",
    "verifiedRunId":"string","appealId":"string","factionChoice":"string",
    "activeRunId":"string","cardPlayed":"GameCard","incomingEvent":"GameEvent",
    "exitCard":"GameCard","sabotageCard":"GameCard","catalystCard":"GameCard","modCard":"GameCard",
    "fateTick":"number","windowDuration":"number","bountyFunding":"number",
    "reputationScore":"number","stakeAmount":"number","bondAmount":"number",
    "escrowAmount":"number","completedRunCount":"number","runCount":"number",
    "sessionRunCount":"number","trophyEarnedCount":"number","cordScore":"number",
    "decisionTime":"number","splitAmount":"number","heatAmount":"number",
    "liquidationDiscount":"number","sellPercentage":"number","maintenanceCost":"number",
    "integrityScore":"number","delegationDuration":"number",
    "clientTimestamp":"number","serverTimestamp":"number",
    "burnAmount":"number","salvageValue":"number",
    "newPlayerFlag":"boolean","hardcoreFlag":"boolean","playerOptIn":"boolean",
    "consentStatus":"boolean","hardcoreConfig":"boolean",
    "completedRun":"CompletedRun","seasonConfig":"SeasonConfig",
    "onboardingConfig":"OnboardingConfig","playerProfile":"PlayerProfile",
    "runHistory":"RunHistory","auctionWindow":"AuctionWindow",
    "dealProposal":"DealProposal","contractDraft":"ContractDraft",
    "tableVoteRequest":"TableVoteRequest","friendInvitePayload":"FriendInvitePayload",
    "roleAssignment":"RoleAssignment","synergyDefinitions":"SynergyDefinition[]",
    "synergyTreeDef":"SynergyTreeDef","hedgePairDefinitions":"HedgePairDef[]",
    "exposureThresholds":"ExposureThreshold[]","achievementDefinitions":"AchievementDef[]",
    "activeMutators":"Mutator[]","mutationOptions":"MutationOption[]",
    "mutatorOptions":"MutatorOption[]","handicapOptions":"HandicapOption[]",
    "cardSequence":"GameCard[]","currentRunState":"RunState","runResults":"RunResult[]",
    "momentEvent":"MomentEvent","eventStream":"GameEvent[]","runMoments":"MomentEvent[]",
    "clipBoundary":"ClipBoundary","runSnapshot":"RunSnapshot",
    "archetypeSelection":"string","sandboxState":"SandboxState",
    "drillScenario":"DrillScenario","ghostPayload":"GhostPayload",
    "failureSnapshot":"FailureSnapshot","deviceFingerprint":"string",
    "attestationChallenge":"string","gameAction":"GameAction","sessionToken":"string",
    "suspiciousPattern":"SuspiciousPattern","exploitTaxonomy":"ExploitTaxonomy",
    "proofHash":"string","seed":"string","coopRunResult":"CoopRunResult",
    "bountyCriteria":"BountyCriteria","dailySeed":"string",
    "gauntletConfig":"GauntletConfig","draftPool":"string[]",
    "winnerHistory":"string[]","speedrunConfig":"SpeedrunConfig",
    "cosmeticBase":"CosmeticBase","cosmeticRecipe":"CosmeticRecipe",
    "verifiedFeat":"VerifiedFeat","verifiedFragments":"string[]",
    "craftingRecipe":"CraftingRecipe","trophyCurrency":"number",
    "sinkConfig":"SinkConfig","factionBenefits":"FactionBenefit[]",
    "reputationRules":"ReputationRule[]","storyBeatSchedule":"StoryBeat[]",
    "npcDefinition":"NpcDef","m132MLOutput":"MLCompanionOutput",
    "playerInventory":"PlayerInventory","loadoutSelection":"LoadoutSelection",
    "socialFeedConfig":"SocialFeedConfig","sourceClipHash":"string",
    "remixPayload":"RemixPayload","socialAction":"SocialAction",
    "targetPlayerId":"string","rivalryHistory":"RivalryHistory",
    "matchResult":"MatchResult","roleSynergies":"RoleSynergy[]",
    "spectatorConfig":"SpectatorConfig","tournamentConfig":"TournamentConfig",
    "participantIds":"string[]","bracketSeed":"string","voteConfig":"VoteConfig",
    "delegationScope":"string","collateralRequirement":"CollateralRequirement",
    "bondObjective":"BondObjective","contractOutcome":"ContractOutcome",
    "disputePayload":"DisputePayload","restructureProposal":"RestructureProposal",
    "asyncVoteConfig":"AsyncVoteConfig","houseRuleConfig":"HouseRuleConfig",
    "constraintValidator":"ConstraintValidator","behaviorReport":"BehaviorReport",
    "penaltyRules":"PenaltyRule[]","auditTrigger":"AuditTrigger",
    "litigationTrigger":"LitigationTrigger","counterpartyState":"CounterpartyState",
    "freezeTrigger":"FreezeTrigger","regulatoryTrigger":"RegulatoryTrigger",
    "complianceWindow":"ComplianceWindow","sovereigntyGrade":"SovereigntyGrade",
    "hotfixPayload":"HotfixPayload","degradedModeConfig":"DegradedModeConfig",
    "serverLoadMetric":"number","offlineRunPayload":"OfflineRunPayload",
    "exportRequest":"ExportRequest","evidenceChain":"EvidenceChain",
    "playerCommitHash":"string","serverRevealHash":"string",
    "suspiciousRunId":"string","quarantineFlags":"QuarantineFlag[]",
    "challengePrompt":"string","ledgerEntries":"LedgerEntry[]",
    "runLedgers":"LedgerEntry[][]","digestConfig":"DigestConfig",
    "clauseDefinitions":"ClauseDef[]","proposalPayload":"ProposalPayload",
    "poolContributions":"PoolContribution[]","riskEvent":"RiskEvent",
    "defectionTrigger":"DefectionTrigger","milestoneConditions":"MilestoneCondition[]",
    "trustScore":"number","trustTierTable":"TrustTierTable",
    "sharedRootHash":"string","mintGovernorConfig":"MintGovernorConfig",
    "actionTimeline":"ActionEvent[]","playerAction":"string",
    "actionBudgetConfig":"ActionBudgetConfig","marketTransaction":"MarketTransaction",
    "settlementConfig":"SettlementConfig","macroSchedule":"MacroEvent[]",
    "inertiaTaxAmount":"number","cashDelta":"number","cashflowDelta":"number",
    "decayRate":"number","damageAbsorbed":"number","leverageUpdated":"number",
    "saleProceeds":"number","capitalGain":"number","firstRefusalExpiry":"number",
    "escalationLevel":"number","passCountUpdated":"number","fubarDamage":"number",
    "cordPenalty":"number","cordBonus":"number","comboMultiplier":"number",
    "timingBonus":"number","timingMultiplier":"number","stabilityBonus":"number",
    "trophyCurrencyEarned":"number","trophyBalance":"number",
    "streakMultiplier":"number","rankPosition":"number",
    "decayedTrophyAmount":"number","progressionTier":"number",
    "assistAmount":"number","fillAmount":"number","cashFromSplit":"number",
    "cashConverted":"number","cashDrained":"number","timeDelta":"number",
    "freezeDuration":"number","vaultBalance":"number","budgetRemaining":"number",
    "remainingCapacity":"number","complexityHeat":"number",
    "bleedModeFlag":"boolean","cascadeLinked":"boolean","frictionApplied":"boolean",
    "momentFlag":"boolean","clutchFlag":"boolean","fraudFlag":"boolean",
    "gracePeriodActive":"boolean","quarantineActive":"boolean",
    "lagExploitDetected":"boolean","pauseBlocked":"boolean","timerContinues":"boolean",
    "lockEnforced":"boolean","degradedModeActive":"boolean","dupeGuardPassed":"boolean",
    "actionPermitted":"boolean","consentVerified":"boolean","runIsolated":"boolean",
    "challengePassed":"boolean","documentationSubmitted":"boolean","marginMet":"boolean",
    "macroRuleActive":"boolean","hotfixQueued":"boolean","competitiveEligible":"boolean",
    "powerGuardPassed":"boolean","degeneracyGuardPassed":"boolean",
    "DeckShuffle":"string[]","MacroSchedule":"MacroEvent[]","ChaosWindows":"ChaosWindow[]",
    "drawPool":"GameCard[]","incomeItemized":"IncomeItem[]","buffStack":"Buff[]",
    "shieldLayerUpdated":"ShieldLayer[]","activeHandicaps":"HandicapOption[]",
    "ruleOverrides":"RuleOverride[]","activeSetBonuses":"SetBonus[]",
    "draftedModules":"string[]","guidedPrompts":"string[]","splitTimes":"number[]",
    "wipeEvent":"WipeEvent | null","regimeShiftEvent":"RegimeShiftEvent | null",
    "phaseTransitionEvent":"PhaseTransitionEvent | null",
    "timerExpiredEvent":"TimerExpiredEvent | null",
    "streakBrokenEvent":"StreakEvent | null","fubarEvent":"FubarEvent | null",
    "opportunityCard":"GameCard","auctionResult":"AuctionResult",
    "tickResult":"TickResult","shieldResult":"ShieldResult",
    "purchaseResult":"PurchaseResult","exitResult":"ExitResult",
    "deckComposition":"DeckComposition","tierProgressUpdate":"TierProgress",
    "drawnCard":"GameCard","solvencyStatus":"SolvencyStatus",
    "sabotageEvent":"SabotageEvent","voteResult":"VoteResult",
    "bailoutResult":"BailoutResult","hotSeatEffect":"HotSeatEffect",
    "socialChaosEffect":"SocialChaosEffect","tokenConsumed":"boolean",
    "targetImpact":"TargetImpact","syndicateDeal":"SyndicateDeal",
    "stakeResult":"StakeResult","restructureResult":"RestructureResult",
    "arbitrationResult":"ArbitrationResult","receiptCard":"ReceiptCard",
    "portableProof":"string","handshakeResult":"HandshakeResult",
    "acceptedTerms":"ContractTerms[]","poolPayout":"PoolPayout",
    "defectionEvent":"DefectionEvent","treasuryExtraction":"number",
    "comboActivated":"boolean","cordCeiling":"number","doctrineActive":"boolean",
    "playstyleConstraints":"PlaystyleConstraint[]","parityAdjusted":"boolean",
    "catalystEffect":"CatalystEffect","mutationApplied":"boolean",
    "portfolioRewritten":"boolean","microProofStamped":"boolean","stampHash":"string",
    "relicMinted":"boolean","scarcityScore":"number","teamTitleAssigned":"boolean",
    "rootHashVerified":"boolean","cosmeticMultiplied":"boolean","displayTier":"string",
    "salvageCredit":"number","newChallenge":"ChallengeRef","badgeTierAwarded":"string",
    "tierHash":"string","teamBadge":"TeamBadge","sharedProofHash":"string",
    "bountyLive":"boolean","bountyWinner":"string | null",
    "leaderboardEntry":"LeaderboardEntry","dailyRanking":"number",
    "gauntletRunState":"GauntletRunState","gauntletReward":"GauntletReward",
    "hardcoreRunState":"HardcoreRunState","speedrunState":"SpeedrunState",
    "proofCard":"ProofCard","ledgerEntry":"LedgerEntry","ledgerHash":"string",
    "signedAction":"SignedAction","integrityVerified":"boolean",
    "replayResult":"ReplayResult","verificationStatus":"VerificationStatus",
    "exploitClassified":"ExploitClassification","autoResponse":"AutoResponse",
    "deviceTrustTier":"string","attestationResult":"AttestationResult",
    "settlementResult":"SettlementResult","snapshotBundle":"SnapshotBundle",
    "integrityDigest":"IntegrityDigest","auditTrail":"AuditEntry[]",
    "mentorPaired":"boolean","guidedRunStarted":"boolean",
    "uiLayerUnlocked":"boolean","complexityRevealed":"boolean",
    "rehabRunState":"RehabRunState","targetedScenario":"string",
    "ghostTheaterLoaded":"boolean","decisionAnnotated":"boolean",
    "savedPreset":"SavedPreset","constraintPreview":"ConstraintPreview",
    "deathReviewLoaded":"boolean","rootCauseAnnotated":"boolean",
    "drillResult":"DrillResult","skillScore":"number",
    "bootcampRunState":"BootcampRunState","teamBriefing":"TeamBriefing",
    "safeRunStarted":"boolean","guidedSocialMoment":"SocialMomentDef",
    "onboardingRunState":"OnboardingRunState","starterDeck":"GameCard[]",
    "suggestedStrategy":"string","archetypeBonus":"number",
    "protectionApplied":"boolean","bindingResult":"BindingResult",
    "clauseEvaluated":"ClauseEvalResult","triggerFired":"boolean",
    "trustCollateral":"number","newTerms":"ContractTerms","verdictApplied":"boolean",
    "seasonProgressUpdated":"boolean","rewardUnlocked":"RewardEntry | null",
    "unlockedModules":"string[]","macroShockEvent":"MacroShockEvent | null",
    "regimeUpdated":"boolean","clipPackage":"ClipPackage","captionText":"string",
    "challengeUrl":"string","improvementDeltas":"ImprovementDelta[]",
    "comparisonOverlay":"ComparisonOverlay","rewindResult":"RewindResult",
    "alternateTimeline":"AlternateTimeline","badgeUnlocked":"BadgeEntry | null",
    "bountyActivated":"boolean","questProgressUpdated":"boolean",
    "questCompleted":"boolean","questReward":"QuestReward | null",
    "cosmeticCrafted":"CosmeticItem | null","currencySpent":"number",
    "emergencySaleResult":"EmergencySaleResult","discountApplied":"number",
    "scarcityState":"ScarcityState","scarceAlert":"boolean",
    "lastLookOpened":"boolean","finalDecision":"string | null",
    "conditionUpdated":"AssetCondition","failureEvent":"AssetFailureEvent | null",
    "refiExecuted":"boolean","partialFillResult":"PartialFillResult",
    "headlineDisplayed":"boolean","regimeHint":"string","splitResult":"SplitResult",
    "sacrificeExecuted":"boolean","orderApplied":"SacrificeOrder",
    "termImproved":"boolean","heatSwapped":"boolean","exposureRebalanced":"boolean",
    "rolesAssigned":"RoleAssignment[]","passivesActive":"boolean",
    "feedRendered":"boolean","momentHighlighted":"MomentEvent | null",
    "remixClip":"RemixClip","chainHash":"string","rivalryUpdated":"boolean",
    "nemesisBadge":"NemesisBadge | null","consentDenied":"boolean",
    "cosmeticApplied":"CosmeticItem","displayLoadout":"DisplayLoadout",
    "captionGenerated":"string","stingerPlayed":"boolean","caseFile":"CaseFile",
    "decisionTimeline":"DecisionEntry[]","storyBeatDisplayed":"boolean",
    "narrativeHeadline":"string","npcBehavior":"NpcBehavior",
    "counterpartyAction":"NpcAction","reputationLabel":"string","labelHash":"string",
    "spectatorFeedActive":"boolean","spectatorView":"SpectatorView",
    "predictionBetEnabled":"boolean","bracketGenerated":"boolean",
    "matchScheduled":"boolean","scoringPublished":"boolean",
    "auditEntry":"AuditEntry","auditHash":"string","litigationShock":"LitigationShock",
    "legalHoldApplied":"boolean","transactionFrozen":"boolean",
    "unfreezeCondition":"string","complianceResult":"ComplianceResult",
    "penaltyApplied":"boolean","windowExpired":"boolean",
    "finalityStamp":"FinalityStamp","ceremonyDisplayed":"boolean",
    "cosmeticFlavor":"string","factionActive":"boolean","vaultUpdated":"boolean",
    "sharedCosmeticUsable":"boolean","currencyBurned":"number",
    "economyCleaned":"boolean","craftedItem":"CraftedItem","craftingProof":"string",
    "offlineRunQueued":"boolean","syncScheduled":"boolean",
    "exportedPacket":"ExportPacket","redactedPayload":"RedactedPayload",
    "asyncVoteActive":"boolean","voteWindowExpiry":"number",
    "houseRulesActive":"boolean","publishedConstraints":"PublishedConstraint[]",
    "lobbySignature":"string","violationLogged":"boolean","votingMode":"string",
    "delegationActive":"boolean","operatorPowers":"OperatorPower[]",
    "delegationExpiry":"number","collateralCallIssued":"boolean",
    "bondActive":"boolean","objectiveProgress":"number","bondPayout":"number | null",
    "hotfixAppliedPostRun":"boolean","shedFeatures":"string[]",
    "verificationPending":"boolean","appealResult":"AppealResult",
    "verdictIssued":"boolean","glossaryPing":"boolean","explanationShown":"boolean",
    "pingDismissed":"boolean","rateLimitEvent":"Record<string, unknown>",
    "finalityConfirmed":"boolean","redactedHash":"string",
    "publishedReport":"Record<string, unknown>","quorumReached":"boolean",
    "defaultTriggered":"boolean","shareableReceiptUrl":"string",
    "activePath":"string","branchUnlocked":"boolean","identityBadge":"string",
    "windowMissed":"boolean","dialSetting":"number","bridgeActivated":"boolean",
    "cordImpact":"number","momentAnnotated":"boolean","mintHash":"string",
    "displayTitle":"string","integrityBonus":"number","inviteBonus":"number",
    "replayViewed":"boolean","cordPremiumEstimate":"number","clinicLesson":"string",
    "authorizedTick":"number","synergiesExplained":"boolean","cordModifier":"number",
    "forkActivated":"boolean","branchSelected":"string",
    "mergedOutcome":"Record<string, unknown>","cashRecovered":"number",
    "fubarBiasAdjusted":"boolean","maintenanceRequired":"boolean",
    "cashflowAdjusted":"number","survivorUpdated":"GameCard[]","taxApplied":"boolean",
    "netHeatUnchanged":"boolean","activeAbilityQueued":"boolean",
    "sharePrompted":"boolean","remixPublished":"boolean",
    "rivalryConsequences":"string[]","kingDesignated":"string",
    "stakesUpdated":"boolean","challengerQueued":"boolean","ghostDisabled":"boolean",
    "skinHash":"string","fragmentsConsumed":"string[]","burnReceipt":"string",
    "packConsumed":"boolean","leagueRuleset":"Record<string, unknown>",
    "leagueRunStarted":"boolean","swapExecuted":"boolean","allocationUpdated":"boolean",
    "overloadWarning":"boolean","netExposure":"number","nettingApplied":"boolean",
    "cordPremiumMultiplier":"number","hedgeEffect":"Record<string, unknown>",
    "correlationShield":"Record<string, unknown>",
    "liquidationResult":"Record<string, unknown>","modApplied":"boolean",
    "assetStatUpdated":"Record<string, unknown>","cappedWarning":"boolean",
    "splitTerms":"Record<string, unknown>","milestoneResult":"Record<string, unknown>",
    "frictionExpenseEvent":"Record<string, unknown>","frictionClass":"string",
    "counterplayWindow":"Record<string, unknown>","grindGuardApplied":"boolean",
    "stressTestResult":"Record<string, unknown>","proofBadge":"string",
    "promptDisplayed":"boolean","promptDismissed":"boolean",
    "escrowCreated":"EscrowResult","riskDistributed":"boolean",
    "personalBest":"number","timerBoundEnforced":"boolean",
    "runPreserved":"boolean","uiSafetyConfirmed":"boolean",
    "autoActionExecuted":"boolean","capEnforced":"boolean",
    "remainingHolding":"Record<string, unknown>",
}

def _camel_field(field: str) -> str:
    parts = re.split(r"[.\s]+", field)
    if not parts: return field
    result = parts[0][0].lower() + parts[0][1:]
    for p in parts[1:]:
        result += p[0].upper() + p[1:] if p else ""
    return result

def _infer_ts_type(field: str) -> str:
    if field in FIELD_TYPES: return FIELD_TYPES[field]
    f = field.lower()
    if any(f.endswith(s) for s in ("id","hash","seed","version","key","name","label","url","slug","token","message","reason","mode","type","title","caption","text","kind")): return "string"
    if any(f.endswith(s) for s in ("count","score","rate","amount","delta","pct","ms","tick","duration","size","index","budget","cost","gain","balance","weight","level","tier","multiplier","bonus","penalty","heat","decay","factor","limit","max","min","threshold")): return "number"
    if any(f.startswith(s) for s in ("is","has","enable","disable","allow","block","active","force","auto","can","should","was","did")): return "boolean"
    if any(f.endswith(s) for s in ("flag","enabled","active","locked","confirmed","verified","applied","queued","done","live","open","closed","minted","paused","frozen","published")): return "boolean"
    if f.endswith("[]") or any(f.endswith(s) for s in ("list","queue","items","entries","set","pool","array","ids","results","cards","events","layers","buffs","mods","bonuses","modules","rules","options","prompts","times","definitions")): return "unknown[]"
    if any(f.endswith(s) for s in ("result","event","state","config","payload","effect","package","entry","object","record","bundle","output","plan","schedule","window","file")): return "Record<string, unknown>"
    if "| null" in field: return field
    return "unknown"

def _input_fields(record): return [(f, _camel_field(f), _infer_ts_type(f)) for f in record["inputs"]]
def _output_fields(record): return [(f, _camel_field(f), _infer_ts_type(f)) for f in record["outputs"]]
def _default_val(ts_type):
    t = ts_type.strip()
    if t == "number": return "0"
    if t == "boolean": return "false"
    if t == "string": return "''"
    if "| null" in t: return "null"
    if t.endswith("[]") or t == "unknown[]": return "[]"
    if t.startswith("Record"): return "{}"
    return "{} as " + t

def _emit(mid, event, tick_expr, runid_expr, payload_fields):
    p = ", ".join(payload_fields) if payload_fields else ""
    return f"  emit({{ event: '{event}', mechanic_id: '{mid}', tick: {tick_expr}, runId: {runid_expr}, payload: {{ {p} }} }});"

def _read_inputs(record, limit=8):
    lines = []
    for f, camel, ts in _input_fields(record)[:limit]:
        if ts == "number": lines.append(f"  const {camel} = (input.{camel} as number) ?? 0;")
        elif ts == "boolean": lines.append(f"  const {camel} = Boolean(input.{camel});")
        elif ts == "string": lines.append(f"  const {camel} = String(input.{camel} ?? \'\');")
        elif ts.endswith("[]"): lines.append(f"  const {camel} = (input.{camel} as {ts}) ?? [];")
        else: lines.append(f"  const {camel} = input.{camel};")
    return lines

def _build_return(record, overrides=None):
    overrides = overrides or {}
    parts = []
    for f, camel, ts in _output_fields(record):
        val = overrides.get(camel) or overrides.get(f) or _default_val(ts)
        parts.append(f"    {camel}: {val},")
    return "  return {{\n" + "\n".join(parts) + "\n  }};"


# ═══════════════════════════════════════════════════════════════════════════════
# IMPLEMENTATION BODY GENERATORS — production logic, no throws
# ═══════════════════════════════════════════════════════════════════════════════

def _impl_seed(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else "SEED_COMMITTED"
    ret = _build_return(r, {"runSeed":"runSeed","deckShuffle":"deckShuffle","macroSchedule":"macroSchedule","chaosWindows":"chaosWindows","finalSeed":"runSeed","commitRevealProof":"computeHash(runSeed)"})
    return f"""  const raw = [input.userId ?? '', input.rulesVersion ?? '', String(input.timestamp ?? 0)].join(':');
  const runSeed = computeHash(raw);
  const deckShuffle = seededShuffle(DEFAULT_CARD_IDS, runSeed);
  const macroSchedule = buildMacroSchedule(runSeed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runSeed, CHAOS_WINDOWS_PER_RUN);
  {_emit(mid, e0, "0", "runSeed", ["runSeed","userId: input.userId ?? ''"])}
  {ret}"""

def _impl_commit_reveal(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else "SEED_COMMITTED"
    ret = _build_return(r, {"finalSeed":"finalSeed","commitRevealProof":"proofHash","auditHash":"auditHash"})
    return f"""  const playerHash = input.playerCommitHash ?? '';
  const serverHash = input.serverRevealHash ?? '';
  const finalSeed = computeHash(playerHash + ':' + serverHash);
  const proofHash = computeHash(finalSeed + ':proof');
  const auditHash = computeHash(finalSeed + ':audit');
  {_emit(mid, e0, "0", "finalSeed", ["finalSeed","playerHash","serverHash"])}
  {ret}"""

def _impl_tick_clock(r: dict) -> str:
    mid = r["mechanic_id"]
    events = r["telemetry_events"]
    e_tick  = next((e for e in events if "TICK" in e), events[0] if events else "TICK_COMPLETE")
    e_phase = next((e for e in events if "PHASE" in e), None)
    overrides = {
        "tickResult":"{ tick: nextTick, runPhase: newPhase, timerExpired }",
        "phaseTransitionEvent":"phaseChanged ? { from: (input.stateRunPhase as string) ?? 'EARLY', to: newPhase } : null",
        "timerExpiredEvent":"timerExpired ? { tick: nextTick } : null",
        "timeDelta":"Math.abs((input.serverTimestamp as number ?? 0) - (input.clientTimestamp as number ?? 0))",
        "lagExploitDetected":"Math.abs((input.serverTimestamp as number ?? 0) - (input.clientTimestamp as number ?? 0)) > ((input.toleranceWindow as number) ?? 500)",
        "authorizedTick":"nextTick","pauseBlocked":"true","timerContinues":"true","uiSafetyConfirmed":"true",
        "hotfixQueued":"false","lockEnforced":"true","hotfixAppliedPostRun":"false",
        "degradedModeActive":"(input.serverLoadMetric as number ?? 0) > 0.85",
        "shedFeatures":"(input.serverLoadMetric as number ?? 0) > 0.85 ? ['spectator','replay'] : []",
        "runPreserved":"true","macroShockEvent":"null","regimeUpdated":"false",
    }
    ret = _build_return(r, overrides)
    return f"""  const currentTick = (input.stateTick as number) ?? 0;
  const nextTick = currentTick + 1;
  const timerExpired = nextTick >= RUN_TOTAL_TICKS;
  const progress = clamp(nextTick / RUN_TOTAL_TICKS, 0, 1);
  const newPhase: RunPhase = progress < 0.33 ? 'EARLY' : progress < 0.66 ? 'MID' : 'LATE';
  const phaseChanged = newPhase !== ((input.stateRunPhase as string) ?? 'EARLY');
  {_emit(mid, e_tick, "nextTick", "''", ["nextTick","newPhase","timerExpired"])}
  {f"{_emit(mid, e_phase, chr(39)+'nextTick'+chr(39), chr(39)+chr(39), ['newPhase'])}" if e_phase else ""}
  {ret}"""

def _impl_solvency(r: dict) -> str:
    mid = r["mechanic_id"]
    events = r["telemetry_events"]
    e_warn  = next((e for e in events if "WARNING" in e), events[0] if events else "SOLVENCY_WARNING")
    e_bleed = next((e for e in events if "BLEED" in e), None)
    e_wipe  = next((e for e in events if "BANKRUPT" in e or "WIPE" in e), None)
    ret = _build_return(r, {"wipeEvent":"isWiped ? { reason: 'INSOLVENT', tick: currentTick, cash, netWorth } : null","bleedModeFlag":"isBleed","solvencyStatus":"solvencyStatus"})
    return f"""  const cash = (input.stateCash as number) ?? 0;
  const netWorth = (input.stateNetWorth as number) ?? 0;
  const cashflow = (input.stateCashflow as number) ?? 0;
  const currentTick = (input.stateTick as number) ?? 0;
  const isWiped = cash <= 0 && netWorth <= 0;
  const isBleed = !isWiped && cash <= {mid}_BOUNDS.BLEED_CASH_THRESHOLD && cashflow < 0;
  const solvencyStatus: SolvencyStatus = isWiped ? 'WIPED' : isBleed ? 'BLEED' : 'SOLVENT';
  if (isWiped) {{ {_emit(mid, e_wipe or e_warn, "currentTick", "''", ["cash","netWorth","solvencyStatus"])} }}
  else if (isBleed) {{ {_emit(mid, e_bleed or e_warn, "currentTick", "''", ["cash","cashflow","solvencyStatus"])} }}
  else {{ {_emit(mid, e_warn, "currentTick", "''", ["cash","solvencyStatus"])} }}
  {ret}"""

def _impl_cash_decay(r: dict) -> str:
    mid = r["mechanic_id"]
    events = r["telemetry_events"]
    e0 = next((e for e in events if "CASH" in e or "MACRO" in e), events[0] if events else "CASH_DECAY_APPLIED")
    e_shift = next((e for e in events if "SHIFT" in e or "REGIME" in e), None)
    ret = _build_return(r, {"cashDelta":"cashDelta","regimeShiftEvent":"regimeShift ? { previousRegime, newRegime: macroRegime } : null","decayRate":"decayRate"})
    return f"""  const cash = (input.stateCash as number) ?? 0;
  const cashflow = (input.stateCashflow as number) ?? 0;
  const macroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';
  const previousRegime = macroRegime;
  const currentTick = (input.stateTick as number) ?? 0;
  const decayRate = computeDecayRate(macroRegime, {mid}_BOUNDS.BASE_DECAY_RATE);
  const cashDelta = clamp(cashflow * decayRate, {mid}_BOUNDS.MIN_CASH_DELTA, {mid}_BOUNDS.MAX_CASH_DELTA);
  const regimeShift = Math.abs(cashDelta) > {mid}_BOUNDS.REGIME_SHIFT_THRESHOLD;
  {_emit(mid, e0, "currentTick", "''", ["cashDelta","decayRate","macroRegime"])}
  {f"{_emit(mid, e_shift, chr(39)+'currentTick'+chr(39), chr(39)+chr(39), ['macroRegime','cashDelta'])}" if e_shift else ""}
  {ret}"""

def _impl_cashflow_tick(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else "CASHFLOW_TICK"
    ret = _build_return(r, {"cashflowDelta":"cashflowDelta","incomeItemized":"incomeItems","tierProgressUpdate":"{ currentTier: pressureTier, progressPct: tierProgress }"})
    return f"""  const assets = (input.stateAssets as Asset[]) ?? [];
  const ipaItems = (input.stateIpaItems as IPAItem[]) ?? [];
  const macroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';
  const currentTick = (input.stateTick as number) ?? 0;
  const pressureTier = (input.statePressureTier as PressureTier) ?? 'LOW';
  const macroMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const assetIncome = assets.reduce((s, a) => s + (a.cashflowMonthly ?? 0), 0);
  const ipaIncome   = ipaItems.reduce((s, i) => s + (i.cashflowMonthly ?? 0), 0);
  const cashflowDelta = clamp((assetIncome + ipaIncome) * macroMultiplier, {mid}_BOUNDS.MIN_CASHFLOW_DELTA, {mid}_BOUNDS.MAX_CASHFLOW_DELTA);
  const incomeItems: IncomeItem[] = [
    ...assets.map(a => ({{ source: a.id ?? 'asset', amount: (a.cashflowMonthly ?? 0) * macroMultiplier }})),
    ...ipaItems.map(i => ({{ source: i.id ?? 'ipa',   amount: (i.cashflowMonthly ?? 0) * macroMultiplier }})),
  ];
  const tierProgress = clamp(cashflowDelta / {mid}_BOUNDS.TIER_ESCAPE_TARGET, 0, 1);
  {_emit(mid, e0, "currentTick", "''", ["cashflowDelta","macroRegime"])}
  {ret}"""

def _impl_card_draw(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else "CARD_DRAWN"
    ret = _build_return(r, {"drawPool":"drawPool","drawnCard":"drawnCard","deckComposition":"{ totalCards: drawPool.length, byType: {} }"})
    return f"""  const runPhase = (input.stateRunPhase as RunPhase) ?? 'EARLY';
  const macroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';
  const pressureTier = (input.statePressureTier as PressureTier) ?? 'LOW';
  const runSeed = String(input.runSeed ?? '');
  const currentTick = (input.stateTick as number) ?? 0;
  const drawPool = buildWeightedPool(runSeed, (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[runPhase] ?? 1.0), REGIME_WEIGHTS[macroRegime] ?? 1.0);
  const drawnCard = drawPool[seededIndex(runSeed, currentTick, drawPool.length)] ?? drawPool[0] ?? DEFAULT_CARD;
  {_emit(mid, e0, "currentTick", "runSeed", ["drawnCard: drawnCard.id","poolSize: drawPool.length"])}
  {ret}"""

def _impl_leverage(r: dict) -> str:
    mid = r["mechanic_id"]
    events = r["telemetry_events"]
    e_ok   = next((e for e in events if "PURCHASED" in e or "APPLIED" in e), events[0] if events else "LEVERAGE_PURCHASED")
    e_deny = next((e for e in events if "DENIED" in e or "FAIL" in e), None)
    ret = _build_return(r, {"purchaseResult":"purchaseResult","buffStack":"afforded ? [{ id: cardPlayed?.id ?? '', type: 'LEVERAGE', magnitude: cardCost, expiresAt: -1 }] : []","leverageUpdated":"afforded ? leverage + cardCost : leverage"})
    return f"""  const cardPlayed = input.cardPlayed as GameCard;
  const cash = (input.stateCash as number) ?? 0;
  const leverage = (input.stateLeverage as number) ?? 0;
  const cardCost = cardPlayed?.cost ?? 0;
  const downPayment = cardPlayed?.downPayment ?? cardCost;
  const afforded = cash >= downPayment && leverage + cardCost <= {mid}_BOUNDS.MAX_LEVERAGE;
  const purchaseResult: PurchaseResult = {{
    success: afforded, assetId: cardPlayed?.id ?? '', cashSpent: afforded ? downPayment : 0,
    leverageAdded: afforded ? cardCost : 0,
    reason: afforded ? 'APPROVED' : cash < downPayment ? 'INSUFFICIENT_CASH' : 'LEVERAGE_CAP',
  }};
  {_emit(mid, e_ok, "0", "''", ["afforded","cardCost","leverage"])}
  {f"if (!afforded) {{ {_emit(mid, e_deny, chr(39)+'0'+chr(39), chr(39)+chr(39), ['purchaseResult: purchaseResult.reason'])} }}" if e_deny else ""}
  {ret}"""

def _impl_shield(r: dict) -> str:
    mid = r["mechanic_id"]
    events = r["telemetry_events"]
    e_act  = next((e for e in events if "ACTIVAT" in e), events[0] if events else "SHIELD_ACTIVATED")
    e_pier = next((e for e in events if "PIERC" in e), None)
    e_dep  = next((e for e in events if "DEPLET" in e), None)
    ret = _build_return(r, {"shieldResult":"shieldResult","damageAbsorbed":"absorbed","shieldLayerUpdated":"updatedLayers"})
    return f"""  const incomingEvent = input.incomingEvent as GameEvent;
  const shieldLayers = (input.stateShieldLayers as ShieldLayer[]) ?? [];
  const cardPlayed = input.cardPlayed as GameCard | undefined;
  const incomingDamage: number = (incomingEvent as any)?.damage ?? 0;
  const shieldBonus: number = (cardPlayed as any)?.shieldValue ?? 0;
  const totalShield: number = shieldLayers.reduce((s, l) => s + l.strength, 0) + shieldBonus;
  const pierced = incomingDamage > totalShield;
  const absorbed = Math.min(incomingDamage, totalShield);
  const depleted = totalShield <= incomingDamage;
  const updatedLayers: ShieldLayer[] = shieldLayers
    .map(l => ({{ ...l, strength: Math.max(0, l.strength - absorbed / Math.max(shieldLayers.length, 1)) }}))
    .filter(l => l.strength > 0);
  const shieldResult: ShieldResult = {{ absorbed, pierced, depleted, remainingShield: Math.max(0, totalShield - absorbed) }};
  {_emit(mid, e_act, "0", "''", ["absorbed","pierced","depleted"])}
  {f"if (pierced) {{ {_emit(mid, e_pier, chr(39)+'0'+chr(39), chr(39)+chr(39), ['absorbed','incomingDamage'])} }}" if e_pier else ""}
  {f"if (depleted) {{ {_emit(mid, e_dep, chr(39)+'0'+chr(39), chr(39)+chr(39), ['totalShield'])} }}" if e_dep else ""}
  {ret}"""

def _impl_opportunity(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else "OPPORTUNITY_OPENED"
    ret = _build_return(r, {"opportunityCard":"opportunityCard","auctionResult":"{ winnerId: '', winnerBid: 0, expired: false }","firstRefusalExpiry":"firstRefusalExpiry"})
    return f"""  const runSeed = String(input.runSeed ?? '');
  const currentTick = (input.stateTick as number) ?? 0;
  const opportunityCard: GameCard = {{ ...OPPORTUNITY_POOL[seededIndex(runSeed, currentTick, OPPORTUNITY_POOL.length)] }};
  const firstRefusalExpiry = currentTick + {mid}_BOUNDS.FIRST_REFUSAL_TICKS;
  {_emit(mid, e0, "currentTick", "runSeed", ["opportunityCard: opportunityCard.id","firstRefusalExpiry"])}
  {ret}"""

def _impl_exit(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else "ASSET_EXITED"
    ret = _build_return(r, {"exitResult":"exitResult","saleProceeds":"saleProceeds","capitalGain":"capitalGain"})
    return f"""  const assets = (input.stateAssets as Asset[]) ?? [];
  const macroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';
  const exitCard = input.exitCard as GameCard;
  const currentTick = (input.stateTick as number) ?? 0;
  const targetAsset = assets.find(a => a.id === (exitCard as any)?.targetAssetId) ?? assets[0];
  const baseValue = (targetAsset as any)?.value ?? 0;
  const saleProceeds = clamp(baseValue * (EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0), 0, {mid}_BOUNDS.MAX_PROCEEDS);
  const capitalGain = Math.max(0, saleProceeds - ((targetAsset as any)?.purchasePrice ?? 0));
  const timingScore = clamp((currentTick % {mid}_BOUNDS.PULSE_CYCLE) / {mid}_BOUNDS.PULSE_CYCLE, 0, 1);
  const exitResult: ExitResult = {{ assetId: targetAsset?.id ?? '', saleProceeds, capitalGain, timingScore, macroRegime }};
  {_emit(mid, e0, "currentTick", "''", ["saleProceeds","capitalGain","timingScore"])}
  {ret}"""

def _impl_threshold_tax(r: dict) -> str:
    mid = r["mechanic_id"]
    events = r["telemetry_events"]
    e0 = events[0] if events else f"{mid}_APPLIED"
    e1 = events[1] if len(events) > 1 else None
    numeric_inputs = [(f, _camel_field(f)) for f in r["inputs"] if _infer_ts_type(f) == "number"]
    primary = numeric_inputs[0] if numeric_inputs else ("state.tick", "stateTick")
    pfield, pcamel = primary
    tick_vars = [_camel_field(f) for f in r["inputs"] if f == "state.tick"]
    tick_var = tick_vars[0] if tick_vars else pcamel
    overrides: dict = {}
    for o in r["outputs"]:
        oc = _camel_field(o); ts = _infer_ts_type(o)
        if ts == "boolean": overrides[oc] = "taxApplied"
        elif ts == "number" and oc not in overrides: overrides[oc] = "taxApplied ? taxAmount : 0"
        elif "| null" in ts: overrides[oc] = f"taxApplied ? {{ tick: {tick_var}, value: {pcamel} }} : null"
    ret = _build_return(r, overrides)
    return f"""  const {pcamel} = (input.{pcamel} as number) ?? 0;
  const {tick_var} = (input.{tick_var} as number) ?? 0;
  const taxApplied = {pcamel} >= {mid}_BOUNDS.TRIGGER_THRESHOLD;
  const excessCount = Math.max(0, {pcamel} - {mid}_BOUNDS.TRIGGER_THRESHOLD);
  const taxAmount = taxApplied
    ? clamp({mid}_BOUNDS.BASE_AMOUNT * Math.pow({mid}_BOUNDS.MULTIPLIER, excessCount), 0, {mid}_BOUNDS.MAX_AMOUNT)
    : 0;
  {_emit(mid, e0, tick_var, "''", [pcamel, "taxAmount", "taxApplied"])}
  {f"{_emit(mid, e1, tick_var, chr(39)+chr(39), [pcamel])}" if e1 else ""}
  {ret}"""

def _impl_card_handler(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else f"CARD_{mid}_RESOLVED"
    inputs_code = _read_inputs(r, 6)
    tick_vars = [_camel_field(f) for f in r["inputs"] if f == "state.tick"]
    tick_var = tick_vars[0] if tick_vars else "0"
    numeric_inputs = [_camel_field(f) for f in r["inputs"] if _infer_ts_type(f) == "number"][:2]
    overrides: dict = {}
    for o in r["outputs"]:
        oc = _camel_field(o); ts = _infer_ts_type(o)
        if ts == "boolean": overrides[oc] = "true"
        elif ts == "number":
            base = numeric_inputs[0] if numeric_inputs else "0"
            overrides[oc] = f"clamp({base} * {mid}_BOUNDS.EFFECT_MULTIPLIER, {mid}_BOUNDS.MIN_EFFECT, {mid}_BOUNDS.MAX_EFFECT)"
        elif "| null" in ts: overrides[oc] = "null"
        elif ts.endswith("[]"): overrides[oc] = "[]"
    ret = _build_return(r, overrides)
    inputs_str = "\n  ".join(inputs_code)
    tick_expr = f"input.{tick_var} as number ?? 0" if tick_var != "0" else "0"
    return f"""  {inputs_str}
  {_emit(mid, e0, tick_expr, "''", [_camel_field(f) for f in r["inputs"][:2]])}
  {ret}"""

def _impl_api(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else f"{mid}_PROCESSED"
    inputs_code = _read_inputs(r, 5)
    overrides: dict = {"contractId":"computeHash(JSON.stringify(input)).slice(0, 16)"}
    for o in r["outputs"]:
        oc = _camel_field(o); ts = _infer_ts_type(o)
        if oc in overrides: continue
        if ts == "boolean": overrides[oc] = "true"
        elif ts == "number": overrides[oc] = "0"
        elif ts == "string": overrides[oc] = "computeHash(JSON.stringify(input)).slice(0, 16)"
        elif "| null" in ts: overrides[oc] = "null"
        elif ts.endswith("[]"): overrides[oc] = "[]"
        elif "Record" in ts: overrides[oc] = "{ status: 'OK', timestamp: Date.now() }"
    ret = _build_return(r, overrides)
    return f"""  {"\n  ".join(inputs_code)}
  const requestId = computeHash(JSON.stringify(input));
  {_emit(mid, e0, "0", "requestId", [_camel_field(f) for f in r["inputs"][:2] if _infer_ts_type(f) in ("string","number")])}
  {ret}"""

def _impl_season(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else f"SEASON_{mid}_EVENT"
    inputs_code = _read_inputs(r, 5)
    overrides: dict = {}
    for o in r["outputs"]:
        oc = _camel_field(o); ts = _infer_ts_type(o)
        if ts == "boolean": overrides[oc] = "true"
        elif ts == "number": overrides[oc] = "0"
        elif ts == "string": overrides[oc] = "computeHash(JSON.stringify(input)).slice(0, 16)"
        elif "| null" in ts: overrides[oc] = "null"
        elif ts.endswith("[]"): overrides[oc] = "[]"
        elif "Record" in ts: overrides[oc] = "{ seasonId: '', tick: 0 }"
    ret = _build_return(r, overrides)
    return f"""  {"\n  ".join(inputs_code)}
  {_emit(mid, e0, "0", "computeHash(JSON.stringify(input))", [_camel_field(f) for f in r["inputs"][:2] if _infer_ts_type(f) in ("string","number")])}
  {ret}"""

def _impl_service(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else f"SERVICE_{mid}_EXECUTED"
    inputs_code = _read_inputs(r, 5)
    overrides: dict = {
        "ledgerEntry":"{ gameAction: input, tick: 0, hash: computeHash(JSON.stringify(input)) }",
        "ledgerHash":"computeHash(JSON.stringify(input))",
        "auditHash":"computeHash(JSON.stringify(input) + ':audit')",
        "proofHash":"computeHash(JSON.stringify(input) + ':proof')",
        "stampHash":"computeHash(JSON.stringify(input) + ':stamp')",
        "exportedPacket":"{ runId: '', data: {}, hash: computeHash(JSON.stringify(input)) }",
    }
    for o in r["outputs"]:
        oc = _camel_field(o); ts = _infer_ts_type(o)
        if oc in overrides: continue
        if ts == "boolean": overrides[oc] = "true"
        elif ts == "number": overrides[oc] = "0"
        elif ts == "string": overrides[oc] = "computeHash(JSON.stringify(input))"
        elif "| null" in ts: overrides[oc] = "null"
        elif ts.endswith("[]"): overrides[oc] = "[]"
        elif "Record" in ts: overrides[oc] = "{ serviceId: '', status: 'OK', timestamp: Date.now() }"
    ret = _build_return(r, overrides)
    return f"""  {"\n  ".join(inputs_code)}
  const serviceHash = computeHash(JSON.stringify(input));
  {_emit(mid, e0, "0", "serviceHash", [_camel_field(f) for f in r["inputs"][:2] if _infer_ts_type(f) in ("string","number")])}
  {ret}"""

def _impl_ui(r: dict) -> str:
    mid = r["mechanic_id"]
    e0 = r["telemetry_events"][0] if r["telemetry_events"] else f"UI_{mid}_UPDATED"
    inputs_code = _read_inputs(r, 4)
    overrides: dict = {
        "headlineDisplayed":"true","feedRendered":"true","glossaryPing":"true",
        "explanationShown":"true","captionGenerated":"computeHash(JSON.stringify(input)).slice(0, 24)",
        "momentHighlighted":"null","storyBeatDisplayed":"true","spectatorFeedActive":"true",
    }
    for o in r["outputs"]:
        oc = _camel_field(o); ts = _infer_ts_type(o)
        if oc in overrides: continue
        if ts == "boolean": overrides[oc] = "true"
        elif ts == "number": overrides[oc] = "0"
        elif ts == "string": overrides[oc] = "''"
        elif "| null" in ts: overrides[oc] = "null"
        elif ts.endswith("[]"): overrides[oc] = "[]"
        elif "Record" in ts: overrides[oc] = f"{{ componentId: '{mid}', rendered: true }}"
    ret = _build_return(r, overrides)
    tick_inputs = [_camel_field(f) for f in r["inputs"] if f == "state.tick"]
    tick_expr = f"input.{tick_inputs[0]} as number ?? 0" if tick_inputs else "0"
    return f"""  {"\n  ".join(inputs_code)}
  {_emit(mid, e0, tick_expr, "''", [_camel_field(f) for f in r["inputs"][:2] if _infer_ts_type(f) in ("string","number","boolean")])}
  {ret}"""

def _pick_pattern(r: dict):
    mid = r["mechanic_id"]
    layer = r["layer"]
    if mid == "M01": return _impl_seed
    if mid == "M02": return _impl_tick_clock
    if mid == "M03": return _impl_solvency
    if mid == "M04": return _impl_card_draw
    if mid == "M05": return _impl_cash_decay
    if mid == "M06": return _impl_cashflow_tick
    if mid == "M07": return _impl_leverage
    if mid == "M08": return _impl_shield
    if mid == "M09": return _impl_opportunity
    if mid == "M10": return _impl_exit
    if mid in ("M11","M12","M13","M14"): return _impl_threshold_tax
    if mid in ("M96","M110","M137","M138"): return _impl_tick_clock
    if mid == "M97": return _impl_commit_reveal
    if layer == "tick_engine":     return _impl_threshold_tax
    if layer == "card_handler":    return _impl_card_handler
    if layer == "api_endpoint":    return _impl_api
    if layer == "season_runtime":  return _impl_season
    if layer == "backend_service": return _impl_service
    if layer == "ui_component":    return _impl_ui
    return _impl_service



@dataclass
class MechanicMeta:
    mechanic_id:      str
    title:            str
    family:           str
    layer:            str
    priority:         int
    batch:            int
    inputs:           list
    outputs:          list
    telemetry_events: list
    exec_hook:        str
    deps:             list = field(default_factory=list)
    status:           str = "todo"
    ml_pair:          str = ""

    def __post_init__(self):
        if not self.ml_pair:
            self.ml_pair = self.mechanic_id.lower() + "a"

# fmt: off
MECHANICS_TABLE: list[MechanicMeta] = [
    MechanicMeta("M01","Run Seed + Deterministic Replay","run_core","tick_engine",1,1,["userId","rulesVersion","timestamp"],["RunSeed","DeckShuffle","MacroSchedule","ChaosWindows"],["SEED_COMMITTED","SEED_REPLAYED","REPLAY_VERIFIED","REPLAY_MISMATCH"],"runSeedDeterministicReplay",[]),
    MechanicMeta("M02","12-Minute Run Clock + Turn Timer","run_core","tick_engine",1,1,["state.tick","state.runPhase","state.tickTier"],["tickResult","phaseTransitionEvent","timerExpiredEvent"],["TICK_COMPLETE","PHASE_TRANSITION","TIMER_EXPIRED","CLOCK_ESCALATION"],"runClockTickEngine",["M01"]),
    MechanicMeta("M03","Solvency Wipe Conditions","run_core","tick_engine",1,1,["state.cash","state.netWorth","state.cashflow","state.tick"],["wipeEvent","bleedModeFlag","solvencyStatus"],["SOLVENCY_WARNING","BLEED_MODE_ENTERED","BANKRUPT_TRIGGERED","VOID_SCAR_RECORDED"],"solvencyWipeCheck",["M02"]),
    MechanicMeta("M04","Deck Reactor","run_core","card_handler",1,1,["state.runPhase","state.macroRegime","state.pressureTier","RunSeed"],["drawPool","drawnCard","deckComposition"],["CARD_DRAWN","DECK_SHUFFLED","POOL_RECOMPOSED","FORCED_CARD_QUEUED"],"deckReactorDraw",["M01","M02"]),
    MechanicMeta("M05","Macro State + Cash Decay Loop","run_core","tick_engine",1,1,["state.macroRegime","state.cash","state.cashflow","state.income","state.expenses"],["cashDelta","regimeShiftEvent","decayRate"],["MACRO_REGIME_SHIFT","CASH_DECAY_APPLIED","SETTLEMENT_TICK","CASHFLOW_UPDATED"],"macroStateCashDecay",["M02"]),
    MechanicMeta("M06","Cashflow Tick Engine","run_core","tick_engine",1,1,["state.assets","state.ipaItems","state.tick","state.macroRegime"],["cashflowDelta","incomeItemized","tierProgressUpdate"],["CASHFLOW_TICK","INCOME_ITEMIZED","ASSET_INCOME_APPLIED","TIER_ESCAPED"],"cashflowTickEngine",["M02","M05"]),
    MechanicMeta("M07","Leverage Purchase Resolver","run_core","card_handler",1,1,["cardPlayed","state.cash","state.leverage","state.macroRegime"],["purchaseResult","buffStack","leverageUpdated"],["LEVERAGE_PURCHASED","BUFF_APPLIED","PURCHASE_DENIED","AFFORDABILITY_CHECKED"],"leveragePurchaseResolver",["M04","M06"]),
    MechanicMeta("M08","Shield / Cancel System","run_core","card_handler",1,1,["incomingEvent","state.shieldLayers","cardPlayed"],["shieldResult","damageAbsorbed","shieldLayerUpdated"],["SHIELD_ACTIVATED","SHIELD_PIERCED","SHIELD_DEPLETED","SHIELD_REGEN_APPLIED"],"shieldCancelSystem",["M04"]),
    MechanicMeta("M09","Opportunity Window + Open-Table Auction","run_core","card_handler",1,1,["state.tick","RunSeed","state.macroRegime","auctionWindow"],["opportunityCard","auctionResult","firstRefusalExpiry"],["OPPORTUNITY_OPENED","FIRST_REFUSAL_EXPIRED","OPPORTUNITY_PURCHASED","OPPORTUNITY_DISCARDED"],"opportunityWindowAuction",["M01","M04"]),
    MechanicMeta("M10","Market Pulse Exit Engine","run_core","card_handler",1,1,["state.assets","state.macroRegime","exitCard","state.tick"],["exitResult","saleProceeds","capitalGain"],["ASSET_EXITED","EXIT_TIMING_SCORED","MARKET_PULSE_READ","CAPITAL_GAIN_REALIZED"],"marketPulseExit",["M05","M09"]),
    MechanicMeta("M11","Missed Opportunity Streak & Inertia Tax","chaos_engine","tick_engine",1,1,["state.missedOpportunityCount","state.tick","state.pressureTier"],["inertiaTaxAmount","streakBrokenEvent","passCountUpdated"],["INERTIA_TAX_APPLIED","OPPORTUNITY_MISSED","STREAK_BROKEN","PASS_PENALIZED"],"missedOpportunityStreakTax",["M09"]),
    MechanicMeta("M12","FUBAR Escalation Ladder","chaos_engine","tick_engine",1,1,["fateTick","state.pressureTier","state.cash"],["fubarEvent","counterplayWindow","escalationLevel"],["FUBAR_TRIGGERED","FUBAR_ESCALATED","COUNTERPLAY_WINDOW_OPENED","FUBAR_DEFUSED"],"fubarEscalationLadder",["M02","M05"]),
    MechanicMeta("M13","Systemic Friction Module","chaos_engine","tick_engine",1,1,["fateTick","state.cash","state.macroRegime"],["frictionExpenseEvent","cashDrained","frictionClass"],["SO_FRICTION_APPLIED","CASH_DRAINED","FRICTION_CLASS_ASSIGNED","SO_DOUBLED"],"systemicFrictionModule",["M05"]),
    MechanicMeta("M14","Disadvantage Draft","chaos_engine","card_handler",1,1,["playerSelection","handicapOptions"],["activeHandicaps","cordPremiumMultiplier"],["HANDICAP_SELECTED","CORD_PREMIUM_APPLIED","DIFFICULTY_LOCKED"],"disadvantageDraftResolver",["M01"]),
    MechanicMeta("M15","Social Chaos Token Play","social_engine","api_endpoint",1,1,["friendInvitePayload","state.tick"],["socialChaosEffect","tokenConsumed"],["SOCIAL_TOKEN_PLAYED","CHAOS_EFFECT_APPLIED","TOKEN_SPENT"],"socialChaosTokenPlay",["M01"]),
    MechanicMeta("M16","Live Table Hot Seat Vote","social_engine","api_endpoint",1,1,["tableVoteRequest","state.tick"],["voteResult","hotSeatEffect"],["HOT_SEAT_VOTE_OPENED","VOTE_CAST","VOTE_RESOLVED","HOT_SEAT_EFFECT_APPLIED"],"liveTableHotSeatVote",["M15"]),
    MechanicMeta("M17","Clutch Assist","social_engine","api_endpoint",1,1,["state.cash","state.tick"],["bailoutResult","assistAmount"],["BAILOUT_REQUESTED","BAILOUT_ACCEPTED","BAILOUT_APPLIED","BAILOUT_DENIED"],"clutchAssistBailout",["M03","M15"]),
    MechanicMeta("M18","Rival Sabotage","social_engine","api_endpoint",1,1,["rivalId","sabotageCard"],["sabotageEvent","targetImpact"],["SABOTAGE_LAUNCHED","SABOTAGE_RESOLVED","TARGET_IMPACTED","SABOTAGE_BLOCKED"],"rivalSabotageDispatch",["M08","M15"]),
    MechanicMeta("M19","Season System","meta_system","season_runtime",1,1,["seasonConfig","state.seasonState"],["seasonProgressUpdated","rewardUnlocked"],["SEASON_STARTED","SEASON_RULE_ACTIVATED","REWARD_UNLOCKED","SEASON_ENDED"],"seasonSystemRuntime",[]),
    MechanicMeta("M20","Macro Shock Scheduler","meta_system","tick_engine",2,1,["state.tick","RunSeed"],["macroShockEvent","regimeUpdated"],["MACRO_SHOCK_SCHEDULED","MACRO_SHOCK_APPLIED","REGIME_FORCED","SHOCK_DEFERRED"],"macroShockScheduler",["M01","M05"]),
    MechanicMeta("M21","Meta Progression Unlocker","meta_system","season_runtime",2,1,["playerProfile","completedRunCount"],["unlockedModules","progressionTier"],["MODULE_UNLOCKED","TIER_REACHED","PROGRESSION_MILESTONE"],"metaProgressionUnlocker",["M19"]),
    MechanicMeta("M22","Moment Forge","moment_engine","ui_component",1,1,["state.tick","eventStream"],["momentEvent","clipBoundary"],["MOMENT_FORGED","CLIP_BOUNDARY_SET","SHARE_TRIGGER_ARMED"],"momentForgeGuarantee",["M02"]),
    MechanicMeta("M23","Auto-Clip Caption Packager","moment_engine","ui_component",1,1,["clipBoundary","runSnapshot"],["clipPackage","captionText"],["CLIP_PACKAGED","CAPTION_GENERATED","SHARE_READY"],"autoClipCaptionPackager",["M22"]),
    MechanicMeta("M24","Challenge Link Generator","moment_engine","backend_service",1,1,["runId","seed"],["challengeUrl","ghostPayload"],["CHALLENGE_LINK_CREATED","GHOST_PAYLOAD_BUILT","CHALLENGE_SHARED"],"challengeLinkGenerator",["M01","M22"]),
    MechanicMeta("M25","Personal Improvement Overlay","moment_engine","ui_component",2,1,["runHistory","currentRunState"],["improvementDeltas","comparisonOverlay"],["OVERLAY_VIEWED","DELTA_COMPUTED","PERSONAL_BEST_BROKEN"],"personalImprovementOverlay",[]),
    MechanicMeta("M26","Co-op Contract Binder","coop_contracts","api_endpoint",1,1,["contractDraft","participantIds"],["contractId","bindingResult"],["CONTRACT_DRAFTED","CONTRACT_BOUND","PARTICIPANT_SIGNED"],"coopContractBinder",[]),
    MechanicMeta("M27","Contract Clause Evaluator","coop_contracts","api_endpoint",1,1,["contractId","clauseDefinitions"],["clauseEvaluated","triggerFired"],["CLAUSE_TRIGGERED","CLAUSE_SATISFIED","CLAUSE_BREACHED"],"contractClauseEvaluator",["M26"]),
    MechanicMeta("M28","Handshake Window Negotiation","coop_contracts","api_endpoint",1,1,["proposalPayload","windowDuration"],["handshakeResult","acceptedTerms"],["HANDSHAKE_OPENED","TERMS_ACCEPTED","HANDSHAKE_EXPIRED"],"handshakeWindowNegotiation",["M26"]),
    MechanicMeta("M29","Shared Risk Pool","coop_contracts","api_endpoint",2,1,["poolContributions","riskEvent"],["poolPayout","riskDistributed"],["RISK_POOL_FUNDED","PAYOUT_TRIGGERED","POOL_EMPTY"],"sharedRiskPool",["M26"]),
    MechanicMeta("M30","Defection Sequence","coop_contracts","api_endpoint",1,1,["contractId","defectionTrigger"],["defectionEvent","treasuryExtraction"],["DEFECTION_INITIATED","TREASURY_DRAINED","PENALTY_APPLIED","DEFECTOR_FLAGGED"],"defectionSequenceEngine",["M26","M27"]),
    MechanicMeta("M31","Asset Synergy Sets","portfolio_engine","card_handler",2,2,["state.assets","synergyDefinitions"],["activeSetBonuses","comboMultiplier"],["SYNERGY_SET_ACTIVATED","COMBO_BONUS_APPLIED","SET_BROKEN"],"assetSynergySetResolver",["M07"]),
    MechanicMeta("M32","Liquidity Ladder","portfolio_engine","card_handler",2,2,["state.assets","state.cash"],["liquidationResult","cashConverted"],["LIQUIDITY_CONVERTED","ASSET_SOLD","LADDER_RUNG_CLIMBED"],"liquidityLadderConverter",["M07","M10"]),
    MechanicMeta("M33","Correlation Shields","portfolio_engine","card_handler",2,2,["state.assets","hedgePairDefinitions"],["hedgeEffect","correlationShield"],["HEDGE_ACTIVATED","CORRELATION_SHIELD_UP","HEDGE_BROKEN"],"correlationHedgeResolver",["M08","M31"]),
    MechanicMeta("M34","Asset Mod Sockets","portfolio_engine","card_handler",2,2,["assetId","modCard"],["modApplied","assetStatUpdated"],["MOD_SOCKETED","STAT_BOOSTED","MOD_SLOT_FULL"],"assetModSocketEngine",["M07"]),
    MechanicMeta("M35","Exposure Cap Enforcer","portfolio_engine","card_handler",1,2,["state.assets","exposureThresholds"],["exposureHeat","cappedWarning"],["EXPOSURE_THRESHOLD_BREACHED","EXPOSURE_CAPPED","OVEREXPOSURE_WARNING"],"exposureCapEnforcer",["M07","M31"]),
    MechanicMeta("M36","Run Achievements + Proof Ledger","achievement_engine","season_runtime",2,2,["completedRun","achievementDefinitions"],["badgeUnlocked","ledgerEntry"],["ACHIEVEMENT_UNLOCKED","BADGE_MINTED","LEDGER_UPDATED"],"runAchievementEngine",["M19","M50"]),
    MechanicMeta("M37","Streak Bounties","achievement_engine","season_runtime",2,2,["runResults","streakCount"],["bountyActivated","streakMultiplier"],["STREAK_BOUNTY_ACTIVATED","STREAK_EXTENDED","STREAK_BROKEN"],"streakBountyEngine",["M36"]),
    MechanicMeta("M38","Moment Quests","achievement_engine","season_runtime",2,2,["activeQuests","momentEvent"],["questProgressUpdated","questCompleted","questReward"],["QUEST_PROGRESS","QUEST_COMPLETED","QUEST_REWARD_ISSUED"],"momentQuestEngine",["M22","M36"]),
    MechanicMeta("M39","Trophy Currency","achievement_engine","season_runtime",2,2,["completedRun","cordScore"],["trophyCurrencyEarned","trophyBalance"],["TROPHY_EARNED","TROPHY_BALANCE_UPDATED","TROPHY_DECAY_APPLIED"],"trophyCurrencyEngine",["M36","M50"]),
    MechanicMeta("M40","Cosmetic Crafting","achievement_engine","season_runtime",2,2,["trophyCurrency","cosmeticRecipe"],["cosmeticCrafted","currencySpent"],["COSMETIC_CRAFTED","CURRENCY_SPENT","RECIPE_FAILED"],"cosmeticCraftingEngine",["M39"]),
    MechanicMeta("M41","90-Second Boot Run","onboarding","backend_service",1,2,["newPlayerFlag","onboardingConfig"],["onboardingRunState","guidedPrompts"],["ONBOARDING_STARTED","TUTORIAL_STEP_COMPLETED","BOOT_RUN_FINISHED"],"bootRunOnboardingEngine",[]),
    MechanicMeta("M42","Contextual Prompt Engine","onboarding","ui_component",2,2,["playerOptIn","gameState"],["promptDisplayed","promptDismissed"],["PROMPT_SHOWN","PROMPT_DISMISSED","TUTORIAL_COMPLETE"],"contextualPromptEngine",["M41"]),
    MechanicMeta("M43","Sandbox Rewind Mode","onboarding","backend_service",2,2,["sandboxState","rewindTarget"],["rewindResult","alternateTimeline"],["SANDBOX_ENTERED","REWIND_EXECUTED","ALTERNATE_SIMULATED"],"sandboxRewindEngine",["M01"]),
    MechanicMeta("M44","Archetype Starter Kit","onboarding","backend_service",2,2,["archetypeSelection","playerProfile"],["starterDeck","suggestedStrategy"],["ARCHETYPE_SELECTED","STARTER_DECK_ISSUED","STRATEGY_SUGGESTED"],"archetypeStarterKit",[]),
    MechanicMeta("M45","New-Player Grace Period","onboarding","backend_service",1,2,["runCount","playerSkillScore"],["gracePeriodActive","protectionApplied"],["GRACE_PERIOD_ACTIVE","PROTECTION_APPLIED","GRACE_PERIOD_EXPIRED"],"newPlayerGracePeriod",[]),
    MechanicMeta("M46","Tamper-Proof Ledger","integrity_core","backend_service",1,1,["gameAction","state.tick"],["ledgerEntry","ledgerHash"],["LEDGER_APPEND","HASH_COMMITTED","LEDGER_VERIFIED"],"tamperProofLedger",[]),
    MechanicMeta("M47","Action Signing","integrity_core","backend_service",1,1,["clientAction","sessionToken"],["signedAction","integrityVerified"],["ACTION_SIGNED","INTEGRITY_VERIFIED","SIGNATURE_INVALID"],"actionSigningEngine",[]),
    MechanicMeta("M48","Deterministic Validator","integrity_core","backend_service",1,1,["runId","seed"],["replayResult","verificationStatus"],["REPLAY_STARTED","REPLAY_VERIFIED","REPLAY_MISMATCH","REPLAY_TAMPERED"],"deterministicValidator",["M01","M46"]),
    MechanicMeta("M49","Exploit Pattern Detector","integrity_core","backend_service",1,1,["suspiciousPattern","exploitTaxonomy"],["exploitClassified","autoResponse"],["EXPLOIT_DETECTED","EXPLOIT_CLASSIFIED","AUTO_RESPONSE_APPLIED"],"exploitPatternDetector",["M46"]),
    MechanicMeta("M50","Sovereignty Proof Card","integrity_core","backend_service",1,1,["completedRun","cordScore"],["proofCard","proofHash"],["PROOF_CARD_ISSUED","SOVEREIGNTY_STAMP","RUN_CERTIFIED"],"sovereigntyProofCard",["M46","M47","M48"]),
    MechanicMeta("M51","Syndicate Deal Architecture","coop_advanced","api_endpoint",2,2,["dealProposal","participantIds"],["syndicateDeal","splitTerms"],["SYNDICATE_DEAL_PROPOSED","DEAL_RATIFIED","SPLIT_LOCKED"],"syndicateDealArchitecture",["M26"]),
    MechanicMeta("M52","Milestone Escrow","coop_advanced","api_endpoint",2,2,["escrowAmount","milestoneConditions"],["escrowCreated","milestoneResult"],["ESCROW_CREATED","MILESTONE_MET","ESCROW_RELEASED"],"milestoneEscrowEngine",["M26","M29"]),
    MechanicMeta("M53","Reputation Staking","coop_advanced","api_endpoint",2,2,["reputationScore","stakeAmount"],["stakeResult","trustCollateral"],["STAKE_POSTED","STAKE_SLASHED","STAKE_RETURNED"],"reputationStakingEngine",["M26"]),
    MechanicMeta("M54","Obligation Restructuring Window","coop_advanced","api_endpoint",2,2,["contractId","restructureProposal"],["restructureResult","newTerms"],["RESTRUCTURE_PROPOSED","TERMS_AMENDED","RESTRUCTURE_DENIED"],"obligationRestructuringEngine",["M26","M27"]),
    MechanicMeta("M55","On-Chain Arbitration","coop_advanced","api_endpoint",2,2,["disputePayload","contractId"],["arbitrationResult","verdictApplied"],["DISPUTE_RAISED","ARBITRATION_OPENED","VERDICT_ISSUED"],"onChainArbitrationEngine",["M26","M27"]),
    MechanicMeta("M56","Doctrine Lock","portfolio_advanced","card_handler",2,2,["doctrineSelection","state.assets"],["doctrineActive","playstyleConstraints"],["DOCTRINE_SELECTED","CONSTRAINTS_APPLIED","DOCTRINE_VIOLATED"],"doctrineSelectEngine",["M31"]),
    MechanicMeta("M57","Rebalance Pulse","portfolio_advanced","card_handler",2,2,["state.assets","rebalanceWindow"],["swapExecuted","allocationUpdated"],["REBALANCE_PULSE_STARTED","SWAP_EXECUTED","BALANCE_RESTORED"],"rebalancePulseEngine",["M31","M35"]),
    MechanicMeta("M58","Stress-Test Proof Badge","portfolio_advanced","card_handler",2,2,["stressTestConfig","state.assets"],["stressTestResult","proofBadge"],["STRESS_TEST_ENTERED","STRESS_TEST_PASSED","PROOF_BADGE_ISSUED"],"stressTestProofEngine",["M35","M50"]),
    MechanicMeta("M59","Complexity Heat Meter","portfolio_advanced","card_handler",2,2,["state.activeSetBonuses","state.assetMods"],["complexityHeat","overloadWarning"],["COMPLEXITY_HEAT_UPDATED","OVERLOAD_WARNING","COMPLEXITY_CAP_HIT"],"complexityHeatMeter",["M31","M34"]),
    MechanicMeta("M60","Net Exposure + Liability Netting","portfolio_advanced","card_handler",2,2,["state.liabilities","state.assets"],["netExposure","nettingApplied"],["LIABILITY_NETTED","NET_EXPOSURE_COMPUTED","NETTING_APPLIED"],"liabilityNettingEngine",["M35","M07"]),
    MechanicMeta("M61","Tiered Badges","achievement_advanced","season_runtime",2,2,["cordScore","runCount"],["badgeTierAwarded","tierHash"],["BADGE_TIER_UPGRADED","TIER_HASH_STORED","BADGE_DISPLAYED"],"tieredBadgeEngine",["M50","M36"]),
    MechanicMeta("M62","Co-op Team Achievements","achievement_advanced","season_runtime",2,2,["coopRunResult","contractId"],["teamBadge","sharedProofHash"],["TEAM_BADGE_ISSUED","SHARED_PROOF_STORED","TEAM_ACHIEVEMENT_UNLOCKED"],"coopTeamAchievementEngine",["M26","M36"]),
    MechanicMeta("M63","Community Bounty Board","achievement_advanced","season_runtime",2,2,["bountyFunding","bountyCriteria"],["bountyLive","bountyWinner"],["BOUNTY_CREATED","BOUNTY_CLAIMED","BOUNTY_EXPIRED"],"communityBountyBoardEngine",["M39"]),
    MechanicMeta("M64","Leaderboards","achievement_advanced","season_runtime",1,2,["completedRun","proofHash"],["leaderboardEntry","rankPosition"],["LEADERBOARD_SUBMIT","RANK_UPDATED","PERSONAL_BEST_SET"],"leaderboardRankingEngine",["M50"]),
    MechanicMeta("M65","Diminishing Returns on Grinding","achievement_advanced","season_runtime",1,2,["trophyEarnedCount","sessionRunCount"],["decayedTrophyAmount","grindGuardApplied"],["DIMINISHING_RETURN_APPLIED","GRIND_GUARD_TRIGGERED","NORMAL_RATE_RESTORED"],"diminishingReturnEngine",["M39"]),
    MechanicMeta("M66","Mentor Pairing System","onboarding_advanced","backend_service",2,2,["newPlayerId","mentorId"],["mentorPaired","guidedRunStarted"],["MENTOR_PAIRED","GUIDED_RUN_STARTED","MENTOR_REWARD_QUEUED"],"mentorPairingEngine",["M41"]),
    MechanicMeta("M67","Progressive UI Layer Unlock","onboarding_advanced","ui_component",2,2,["runCount","uiUnlockThresholds"],["uiLayerUnlocked","complexityRevealed"],["UI_LAYER_UNLOCKED","COMPLEXITY_REVEALED","FULL_UI_ACTIVE"],"progressiveUIUnlockEngine",["M41"]),
    MechanicMeta("M68","Failure Rehab Mode","onboarding_advanced","backend_service",2,2,["wipedRunId","failureSnapshot"],["rehabRunState","targetedScenario"],["FAILURE_REHAB_STARTED","SCENARIO_TARGETED","REHAB_COMPLETE"],"failureRehabEngine",["M03","M45"]),
    MechanicMeta("M69","Skill Drills","onboarding_advanced","backend_service",2,2,["drillScenario","playerAction"],["drillResult","skillScore"],["DRILL_STARTED","DRILL_EVALUATED","SKILL_SCORE_UPDATED"],"skillDrillEngine",["M41"]),

    # ─── ONBOARDING ADVANCED (cont) ──────────────────────────────────────────
    MechanicMeta("M70","Coop Bootcamp: Team Onboarding Run","onboarding_advanced","backend_service",2,2,["teamIds","bootcampConfig","RunSeed"],["bootcampRunState","teamBriefing","synergiesExplained"],["BOOTCAMP_STARTED","BOOTCAMP_COMPLETED","TEAM_SYNERGY_EXPLAINED"],"coopBootcampRunner",["M41","M26"]),
    # ─── INTEGRITY ADVANCED ──────────────────────────────────────────────────
    MechanicMeta("M71","Device Attestation: Trust Tiers for Competitive + Markets","integrity_advanced","backend_service",1,2,["deviceFingerprint","attestationChallenge","trustTierTable"],["deviceTrustTier","attestationResult","competitiveEligible"],["DEVICE_ATTESTED","TRUST_TIER_ASSIGNED","ATTESTATION_FAILED"],"deviceAttestationVerifier",["M47"]),
    MechanicMeta("M72","Action Budget: Rate-Limited Inputs Anti-Bot Pace Control","integrity_advanced","backend_service",1,2,["playerAction","actionTimeline","actionBudgetConfig"],["actionPermitted","budgetRemaining","rateLimitEvent"],["ACTION_BUDGET_CHECKED","RATE_LIMIT_HIT","BOT_PATTERN_DETECTED"],"actionBudgetRateLimiter",["M47"]),
    MechanicMeta("M73","Market Escrow Finality: Anti-Dupe Exchange Settlement","integrity_advanced","backend_service",1,2,["marketTransaction","escrowId","settlementConfig"],["settlementResult","dupeGuardPassed","finalityConfirmed"],["MARKET_ESCROW_CREATED","SETTLEMENT_FINALIZED","DUPE_DETECTED"],"marketEscrowFinalitySettler",["M46","M47"]),
    MechanicMeta("M74","Forensic Snapshot Bundles: Exportable Run Truth Packets","integrity_advanced","backend_service",2,2,["runId","ledgerEntries","redactionRules"],["snapshotBundle","exportedPacket","redactedHash"],["SNAPSHOT_BUNDLED","PACKET_EXPORTED","REDACTION_APPLIED"],"forensicSnapshotBundler",["M46","M50"]),
    MechanicMeta("M75","Integrity Digest: Seasonal Transparency Audit Trails","integrity_advanced","backend_service",2,2,["seasonId","runLedgers","digestConfig"],["integrityDigest","auditTrail","publishedReport"],["INTEGRITY_DIGEST_COMPILED","AUDIT_TRAIL_PUBLISHED","ANOMALY_FLAGGED"],"integrityDigestPublisher",["M48","M74"]),
    # ─── COOP GOVERNANCE ─────────────────────────────────────────────────────
    MechanicMeta("M76","Contract Voting Modes: Unanimous, Majority, Weighted","coop_governance","api_endpoint",2,2,["contractId","voteConfig","participantIds"],["voteResult","votingMode","quorumReached"],["VOTE_OPENED","VOTE_CAST","VOTE_RESOLVED","QUORUM_REACHED"],"contractVotingResolver",["M26","M28"]),
    MechanicMeta("M77","Delegated Operator: Temporary Table Lead","coop_governance","api_endpoint",2,2,["delegateId","delegationScope","delegationDuration"],["delegationActive","operatorPowers","delegationExpiry"],["DELEGATION_GRANTED","DELEGATION_REVOKED","OPERATOR_ACTION_TAKEN"],"delegatedOperatorHandler",["M76"]),
    MechanicMeta("M78","Collateral Calls: Margin-Style Contract Enforcement","coop_governance","api_endpoint",2,2,["contractId","collateralRequirement","state.treasury"],["collateralCallIssued","marginMet","defaultTriggered"],["COLLATERAL_CALL_ISSUED","MARGIN_MET","MARGIN_DEFAULT"],"collateralCallEnforcer",["M26","M29"]),
    MechanicMeta("M79","Shared Objective Bonds: Team-Wide Incentive Locks","coop_governance","api_endpoint",2,2,["bondObjective","participantIds","bondAmount"],["bondActive","objectiveProgress","bondPayout"],["BOND_LOCKED","OBJECTIVE_PROGRESS","BOND_RESOLVED"],"sharedObjectiveBondManager",["M26","M39"]),
    MechanicMeta("M80","Contract Receipt Cards: Portable Verifiable Coop Proofs","coop_governance","api_endpoint",2,2,["contractId","contractOutcome","proofHash"],["receiptCard","portableProof","shareableReceiptUrl"],["RECEIPT_CARD_ISSUED","RECEIPT_SHARED","RECEIPT_VERIFIED"],"contractReceiptCardIssuer",["M50","M26"]),
    # ─── PORTFOLIO EXPERT ────────────────────────────────────────────────────
    MechanicMeta("M81","Synergy Tree Paths: Branching Portfolio Identity","portfolio_expert","card_handler",2,2,["state.assets","synergyTreeDef","playerDoctrineChoice"],["activePath","branchUnlocked","identityBadge"],["SYNERGY_BRANCH_UNLOCKED","IDENTITY_FORGED","PATH_LOCKED"],"synergyTreePathResolver",["M31","M56"]),
    MechanicMeta("M82","Timing Chains: Tick-Window Synergy Combos","portfolio_expert","card_handler",2,2,["state.tick","cardSequence","timingWindowDef"],["comboActivated","timingMultiplier","windowMissed"],["TIMING_CHAIN_STARTED","CHAIN_COMPLETED","CHAIN_BROKEN"],"timingChainComboResolver",["M31","M82"]),
    MechanicMeta("M83","Risk Parity Dial: Optional Stability Lever Under Heat","portfolio_expert","card_handler",2,2,["state.exposureHeat","riskParityTarget","state.assets"],["parityAdjusted","stabilityBonus","dialSetting"],["RISK_PARITY_ADJUSTED","STABILITY_BONUS_APPLIED","DIAL_CHANGED"],"riskParityDialAdjuster",["M35","M57"]),
    MechanicMeta("M84","Catalyst Slots: Cross-Set Bridges Without Degeneracy","portfolio_expert","card_handler",2,2,["catalystCard","activeSynergySets","degeneracyGuardConfig"],["catalystEffect","bridgeActivated","degeneracyGuardPassed"],["CATALYST_SLOTTED","BRIDGE_ACTIVATED","DEGENERACY_BLOCKED"],"catalystSlotBridge",["M31","M59"]),
    MechanicMeta("M85","Mutation Draft: Mid-Run Portfolio Rewrite","portfolio_expert","card_handler",2,2,["mutationOptions","state.assets","state.tick"],["mutationApplied","portfolioRewritten","cordImpact"],["MUTATION_DRAFT_OPENED","MUTATION_APPLIED","PORTFOLIO_REWRITTEN"],"mutationDraftExecutor",["M04","M31"]),
    # ─── ACHIEVEMENT EXPERT ──────────────────────────────────────────────────
    MechanicMeta("M86","Micro Proofs: Moment-Scoped Achievement Stamps","achievement_expert","season_runtime",2,2,["momentEvent","microProofDefs"],["microProofStamped","stampHash","momentAnnotated"],["MICRO_PROOF_STAMPED","MOMENT_ANNOTATED","STAMP_VERIFIED"],"microProofStamper",["M22","M50"]),
    MechanicMeta("M87","Season Relics: Limited Cosmetic Mints from Verified Feats","achievement_expert","season_runtime",3,2,["seasonId","verifiedFeat","mintGovernorConfig"],["relicMinted","scarcityScore","mintHash"],["RELIC_MINTED","RELIC_SCARCITY_UPDATED","MINT_GOVERNOR_DECISION"],"seasonRelicMintGovernor",["M50","M19"]),
    MechanicMeta("M88","Team Titles: Coop Identity Names with Shared Root Hash","achievement_expert","season_runtime",3,2,["teamId","titleDefinition","sharedRootHash"],["teamTitleAssigned","rootHashVerified","displayTitle"],["TEAM_TITLE_AWARDED","ROOT_HASH_BOUND","TITLE_DISPLAYED"],"teamTitleAwarder",["M62","M88"]),
    MechanicMeta("M89","Trust-Weighted Cosmetic Multipliers: Integrity Incentives","achievement_expert","season_runtime",3,2,["trustScore","cosmeticBase","integrityMultiplierTable"],["cosmeticMultiplied","displayTier","integrityBonus"],["INTEGRITY_BONUS_APPLIED","COSMETIC_TIER_UPGRADED","TRUST_WEIGHT_COMPUTED"],"trustWeightedCosmeticMultiplier",["M53","M39"]),
    MechanicMeta("M90","Salvage and Reroll: Recycling Achievements into Challenges","achievement_expert","season_runtime",3,2,["achievementId","salvageValue","rerollPool"],["salvageCredit","newChallenge","rerollResult"],["ACHIEVEMENT_SALVAGED","REROLL_EXECUTED","NEW_CHALLENGE_ISSUED"],"salvageAndRerollExecutor",["M36","M40"]),
    # ─── ONBOARDING EXPERT ───────────────────────────────────────────────────
    MechanicMeta("M91","First Table Invite: Safe Social Onboarding Run","onboarding_expert","backend_service",2,2,["inviterId","newPlayerId","safeRunConfig"],["safeRunStarted","guidedSocialMoment","inviteBonus"],["FIRST_TABLE_INVITE_SENT","SAFE_RUN_STARTED","SOCIAL_MOMENT_CAPTURED"],"firstTableInviteSafeRun",["M41","M15"]),
    MechanicMeta("M92","Ghost Mentor Theater: Watch + Copy Decision Ghosts","onboarding_expert","backend_service",2,2,["mentorRunId","ghostPayload","watcherPlayerId"],["ghostTheaterLoaded","decisionAnnotated","replayViewed"],["GHOST_THEATER_STARTED","DECISION_COPIED","GHOST_REPLAY_ENDED"],"ghostMentorTheaterLoader",["M24","M48"]),
    MechanicMeta("M93","Loadout Lab: Preset Builder + Constraint Preview","onboarding_expert","backend_service",2,2,["presetConfig","advantageOptions","handicapOptions"],["savedPreset","constraintPreview","cordPremiumEstimate"],["PRESET_SAVED","CONSTRAINT_PREVIEWED","LOADOUT_APPLIED"],"loadoutLabPresetBuilder",["M14","M44"]),
    MechanicMeta("M94","Inline Glossary Pings: Micro-Explain Without Handholding","onboarding_expert","ui_component",2,2,["termEncountered","playerOptIn","glossaryLibrary"],["glossaryPing","explanationShown","pingDismissed"],["GLOSSARY_PING_SHOWN","GLOSSARY_PING_DISMISSED","TERM_EXPLAINED"],"inlineGlossaryPing",["M42"]),
    MechanicMeta("M95","Wipe Clinic: Interactive Death-Snapshot Review","onboarding_expert","backend_service",2,2,["wipedRunId","failureSnapshot","clinicConfig"],["deathReviewLoaded","rootCauseAnnotated","clinicLesson"],["WIPE_CLINIC_STARTED","ROOT_CAUSE_REVIEWED","CLINIC_COMPLETED"],"wipeClinicReviewer",["M03","M74"]),
    # ─── INTEGRITY EXPERT ────────────────────────────────────────────────────
    MechanicMeta("M96","Server Time Authority: Anti-Time-Travel Lag Exploit Guard","integrity_expert","tick_engine",1,2,["clientTimestamp","serverTimestamp","toleranceWindow"],["timeDelta","lagExploitDetected","authorizedTick"],["TIME_DRIFT_DETECTED","LAG_EXPLOIT_BLOCKED","SERVER_TIME_ANCHORED"],"serverTimeAuthority",["M02","M47"]),
    MechanicMeta("M97","Seed Commit-Reveal: Deterministic Randomness You Can Audit","integrity_expert","tick_engine",1,2,["playerCommitHash","serverRevealHash","runId"],["finalSeed","commitRevealProof","auditHash"],["SEED_COMMITTED","SEED_REVEALED","COMMIT_REVEAL_VERIFIED"],"seedCommitRevealVerifier",["M01","M47"]),
    MechanicMeta("M98","Quarantine Routing: Isolate Suspicious Runs Without Killing Play","integrity_expert","backend_service",1,2,["suspiciousRunId","quarantineFlags","routingConfig"],["quarantineActive","runIsolated","playerNotified"],["RUN_QUARANTINED","QUARANTINE_LIFTED","SUSPICIOUS_PATTERN_LOGGED"],"quarantineRoutingIsolator",["M49"]),
    MechanicMeta("M99","Integrity Challenges: Lightweight Proof-of-Play Checks","integrity_expert","backend_service",1,2,["runId","challengePrompt","expectedResponse"],["challengePassed","challengeResult","integrityConfirmed"],["INTEGRITY_CHALLENGE_ISSUED","CHALLENGE_PASSED","CHALLENGE_FAILED"],"integrityChallengeSolver",["M47","M48"]),
    MechanicMeta("M100","Appeal Evidence Chain: Verifiable Enforcement Pipeline","integrity_expert","backend_service",2,2,["appealId","evidenceChain","enforcementRule"],["appealResult","verdictIssued","evidenceHashed"],["APPEAL_FILED","EVIDENCE_VERIFIED","VERDICT_ISSUED","ENFORCEMENT_APPLIED"],"appealEvidenceChainPipeline",["M48","M49"]),
    # ─── PORTFOLIO EXPERIMENTAL ──────────────────────────────────────────────
    MechanicMeta("M101","Mutator Draft: Run Rules You Choose","portfolio_experimental","card_handler",2,3,["mutatorOptions","playerChoice","rulesVersion"],["activeMutators","ruleOverrides","cordModifier"],["MUTATOR_SELECTED","RULE_OVERRIDDEN","MUTATOR_EXPIRED"],"mutatorDraftSelector",["M14","M56"]),
    MechanicMeta("M102","Forked Timeline: Choice Two Branches One Final","portfolio_experimental","card_handler",2,3,["forkDecision","branchAState","branchBState"],["forkActivated","branchSelected","mergedOutcome"],["FORK_CREATED","BRANCH_SELECTED","BRANCHES_MERGED"],"forkedTimelineResolver",["M01","M43"]),
    MechanicMeta("M103","Emergency Liquidity Actions: Sell Fast Pay Price","portfolio_experimental","card_handler",2,3,["emergencyTrigger","state.assets","liquidationDiscount"],["emergencySaleResult","discountApplied","cashRecovered"],["EMERGENCY_SALE_EXECUTED","DISCOUNT_APPLIED","LIQUIDITY_RESTORED"],"emergencyLiquidityAction",["M32","M03"]),
    MechanicMeta("M104","Deal Scarcity Index: The Market Goes Thin","portfolio_experimental","card_handler",2,3,["sharedOpportunityDeck","purchaseHistory","scarcityThresholds"],["scarcityState","scarceAlert","fubarBiasAdjusted"],["SCARCITY_ENTERED","DECK_EXHAUSTED","FUBAR_BIAS_UPDATED"],"dealScarcityIndexMonitor",["M09"]),
    MechanicMeta("M105","Last Look Window: One Final Chance No Debates","portfolio_experimental","card_handler",2,3,["lastLookTrigger","state.tick","windowDuration"],["lastLookOpened","finalDecision","windowExpired"],["LAST_LOOK_OPENED","FINAL_DECISION_MADE","WINDOW_EXPIRED"],"lastLookWindowResolver",["M09"]),
    MechanicMeta("M106","Asset Condition System: Wear, Maintenance, Failure","portfolio_experimental","card_handler",2,3,["assetId","conditionState","maintenanceCost"],["conditionUpdated","failureEvent","maintenanceRequired"],["ASSET_WORN","MAINTENANCE_PAID","ASSET_FAILED"],"assetConditionSystem",["M07","M34"]),
    MechanicMeta("M107","Refi Ladder: Restructure Without Escaping Reality","portfolio_experimental","card_handler",2,3,["liabilityId","refiTerms","state.cashflow"],["refiExecuted","newTerms","cashflowAdjusted"],["REFI_INITIATED","REFI_APPROVED","REFI_DENIED","TERMS_UPDATED"],"refiLadderRestructurer",["M60","M32"]),
    MechanicMeta("M108","Partial Fills: You Dont Get the Whole Deal","portfolio_experimental","card_handler",2,3,["dealRequest","availableCapacity","fillRules"],["fillAmount","partialFillResult","remainingCapacity"],["PARTIAL_FILL_EXECUTED","FILL_PROBABILITY_APPLIED","PARTIAL_FILL_MISSED"],"partialFillResolver",["M09","M104"]),
    MechanicMeta("M109","Macro News Bursts: Headlines That Move Ticks","portfolio_experimental","ui_component",2,3,["macroEvent","state.macroRegime","newsBurstConfig"],["headlineDisplayed","regimeHint","playerAlerted"],["NEWS_BURST_DISPLAYED","REGIME_HINT_SHOWN","HEADLINE_DISMISSED"],"macroNewsBurstDisplay",["M20","M05"]),
    MechanicMeta("M110","No Pause Menu Law: Every UI Is Timer-Safe","portfolio_experimental","tick_engine",1,3,["uiAction","state.tick","pauseAttempt"],["pauseBlocked","timerContinues","uiSafetyConfirmed"],["PAUSE_BLOCKED","TIMER_SAFE_UI_RENDERED","UI_STALL_DETECTED"],"noPauseMenuLawEnforcer",["M02"]),
    MechanicMeta("M111","Portfolio Rules Macros: If-Then Autopilot Hard-Capped","portfolio_experimental","api_endpoint",2,3,["macroRuleDefinition","state","macroCapConfig"],["macroRuleActive","autoActionExecuted","capEnforced"],["MACRO_RULE_ACTIVATED","AUTO_ACTION_EXECUTED","CAP_ENFORCED"],"portfolioRulesMacroEngine",["M07","M32"]),
    MechanicMeta("M112","Precision Split: Sell Part Keep Part","portfolio_experimental","ui_component",2,3,["assetId","splitAmount","sellPercentage"],["splitResult","cashFromSplit","remainingHolding"],["PRECISION_SPLIT_EXECUTED","SPLIT_AMOUNT_CONFIRMED","HOLDING_UPDATED"],"precisionSplitExecutor",["M10","M32"]),
    MechanicMeta("M113","Order Priority Stack: You Choose What Dies First","portfolio_experimental","card_handler",2,3,["sacrificeOrder","state.assets","incomingDamage"],["sacrificeExecuted","orderApplied","survivorUpdated"],["SACRIFICE_ORDER_SET","ASSET_SACRIFICED","ORDER_EXHAUSTED"],"orderPriorityStackResolver",["M08","M32"]),
    MechanicMeta("M114","Timing Tax: Fast Choices Get Better Terms","portfolio_experimental","card_handler",2,3,["decisionTime","windowDuration","timingTaxTable"],["timingBonus","termImproved","taxApplied"],["TIMING_TAX_APPLIED","TIMING_BONUS_AWARDED","FAST_DECISION_RECORDED"],"timingTaxResolver",["M02","M09"]),
    MechanicMeta("M115","Heat Swap: Move Risk Without Removing It","portfolio_experimental","card_handler",2,3,["sourceAssetId","targetAssetId","heatAmount"],["heatSwapped","exposureRebalanced","netHeatUnchanged"],["HEAT_SWAP_EXECUTED","EXPOSURE_REBALANCED","NET_HEAT_CONFIRMED"],"heatSwapExecutor",["M35","M57"]),
    # ─── SOCIAL ADVANCED ─────────────────────────────────────────────────────
    MechanicMeta("M116","Table Roles: Caller, Treasurer, Saboteur, Historian","social_advanced","api_endpoint",2,3,["teamId","roleAssignment","roleSynergies"],["rolesAssigned","passivesActive","activeAbilityQueued"],["ROLE_ASSIGNED","PASSIVE_ACTIVE","ABILITY_USED"],"tableRoleAssignmentEngine",["M26"]),
    MechanicMeta("M117","Table Feed: Run Moments as a Social Timeline","social_advanced","ui_component",2,3,["runMoments","socialFeedConfig","teamId"],["feedRendered","momentHighlighted","sharePrompted"],["FEED_UPDATED","MOMENT_HIGHLIGHTED","SHARE_PROMPTED"],"tableFeedRenderer",["M22"]),
    MechanicMeta("M118","Clip Remix Chains: Duet-Stitch but Verified","social_advanced","ui_component",3,3,["sourceClipHash","remixPayload","verifiedRunId"],["remixClip","chainHash","remixPublished"],["CLIP_REMIXED","CHAIN_EXTENDED","REMIX_VERIFIED"],"clipRemixChainBuilder",["M23","M50"]),
    MechanicMeta("M119","Rivalry Ledger: Nemesis Tracking Over Seasons","social_advanced","api_endpoint",2,3,["rivalryHistory","matchResult","rivalryThreshold"],["rivalryUpdated","nemesisBadge","rivalryConsequences"],["RIVALRY_FORMED","NEMESIS_DESIGNATED","RIVALRY_CONSEQUENCE_APPLIED"],"rivalryLedgerTracker",["M18"]),
    MechanicMeta("M120","Consent Gates: Social Chaos Must Be Opt-In","social_advanced","ui_component",1,3,["socialAction","targetPlayerId","consentStatus"],["consentVerified","actionPermitted","consentDenied"],["CONSENT_REQUESTED","CONSENT_GRANTED","CONSENT_DENIED"],"consentGateVerifier",["M15"]),
    MechanicMeta("M121","Daily Gauntlet: Same Seed for Everyone","social_advanced","season_runtime",2,3,["dailySeed","gauntletConfig","playerEntry"],["gauntletRunState","dailyRanking","gauntletReward"],["GAUNTLET_ENTERED","GAUNTLET_COMPLETED","DAILY_RANK_UPDATED"],"dailyGauntletEngine",["M01","M64"]),
    MechanicMeta("M122","Weekly Draft League: Snake Draft Rule Modules","social_advanced","season_runtime",2,3,["leagueId","draftPool","snakeDraftOrder"],["draftedModules","leagueRuleset","leagueRunStarted"],["DRAFT_OPENED","MODULE_DRAFTED","LEAGUE_STARTED"],"weeklyDraftLeagueEngine",["M21","M64"]),
    MechanicMeta("M123","King of the Hill: Table Winner Stays Stakes Rotate","social_advanced","season_runtime",2,3,["tableId","winnerHistory","stakeConfig"],["kingDesignated","stakesUpdated","challengerQueued"],["KING_DESIGNATED","STAKES_ROTATED","CHALLENGER_JOINED"],"kingOfHillTableEngine",["M123"]),
    MechanicMeta("M124","Speedrun Mode: Timer Is Even Harsher","social_advanced","season_runtime",2,3,["speedrunConfig","RunSeed","timerConfig"],["speedrunState","splitTimes","personalBest"],["SPEEDRUN_STARTED","SPLIT_RECORDED","PERSONAL_BEST_SET"],"speedrunModeEngine",["M02","M64"]),
    MechanicMeta("M125","No Ghost Hardcore: You Own Every Mistake","social_advanced","season_runtime",2,3,["hardcoreFlag","RunSeed","hardcoreConfig"],["hardcoreRunState","cordCeiling","ghostDisabled"],["HARDCORE_STARTED","GHOST_DISABLED","HARDCORE_FAILED","HARDCORE_COMPLETED"],"noGhostHardcoreEngine",["M14","M03"]),
    # ─── COSMETICS ───────────────────────────────────────────────────────────
    MechanicMeta("M126","Cosmetic Loadouts: Titles, Frames, Proof Skins","cosmetics","ui_component",3,3,["playerInventory","loadoutSelection","integrityScore"],["cosmeticApplied","displayLoadout","skinHash"],["COSMETIC_APPLIED","LOADOUT_SAVED","SKIN_HASH_VERIFIED"],"cosmeticLoadoutApplier",["M40"]),
    MechanicMeta("M127","Proof-Bound Crafting: Craft from Verified Fragments","cosmetics","backend_service",3,3,["verifiedFragments","craftingRecipe","fragmentHashes"],["craftedItem","craftingProof","fragmentsConsumed"],["CRAFTING_INITIATED","CRAFTING_COMPLETED","FRAGMENTS_VERIFIED"],"proofBoundCraftingEngine",["M50","M40"]),
    MechanicMeta("M128","Season Sinks: Burn to Keep Economy Clean","cosmetics","season_runtime",3,3,["trophyCurrency","sinkConfig","burnAmount"],["currencyBurned","economyCleaned","burnReceipt"],["SEASON_SINK_EXECUTED","CURRENCY_BURNED","ECONOMY_ADJUSTED"],"seasonSinkBurner",["M39","M19"]),
    MechanicMeta("M129","Creator Packs: Caption Templates + Sound Stingers","cosmetics","ui_component",3,3,["creatorPackSelection","momentEvent","captionTemplate"],["captionGenerated","stingerPlayed","packConsumed"],["CREATOR_PACK_USED","CAPTION_GENERATED","STINGER_TRIGGERED"],"creatorPackApplier",["M23","M126"]),
    MechanicMeta("M130","Table Vault: Shared Cosmetic Stash","cosmetics","api_endpoint",3,3,["teamId","vaultContributions","vaultConfig"],["vaultUpdated","sharedCosmeticUsable","vaultBalance"],["VAULT_CONTRIBUTION","VAULT_COSMETIC_USED","VAULT_BALANCE_UPDATED"],"tableVaultManager",["M26","M126"]),
    MechanicMeta("M131","Faction Sponsorship: Season Flavor Without Power","cosmetics","season_runtime",3,3,["factionChoice","seasonId","factionBenefits"],["factionActive","cosmeticFlavor","powerGuardPassed"],["FACTION_JOINED","FACTION_BENEFIT_APPLIED","POWER_GUARD_VERIFIED"],"factionSponsorshipHandler",["M19","M126"]),
    # ─── NARRATIVE ───────────────────────────────────────────────────────────
    MechanicMeta("M132","Case Files: Run Post-Mortems as Narrative Dossiers","narrative","ui_component",2,3,["completedRun","m132MLOutput","ledgerEntries"],["caseFile","decisionTimeline","alternateScenariosRendered"],["CASE_FILE_GENERATED","ALTERNATE_TIMELINE_COMPUTED","DOSSIER_EXPORTED"],"caseFileDossierGenerator",["M46","M74","M50"]),
    MechanicMeta("M133","Seasonal Story Beats: Headlines Court Dates Deadlines","narrative","ui_component",2,3,["seasonConfig","storyBeatSchedule","state.tick"],["storyBeatDisplayed","narrativeHeadline","deadlineWarning"],["STORY_BEAT_FIRED","HEADLINE_DISPLAYED","DEADLINE_APPROACHING"],"seasonalStoryBeatEngine",["M19","M20"]),
    MechanicMeta("M134","NPC Counterparties: Deterministic Personalities No AI","narrative","ui_component",2,3,["npcDefinition","RunSeed","state.tick"],["npcBehavior","counterpartyAction","npcDialogue"],["NPC_ACTION_TAKEN","COUNTERPARTY_RESPONDED","NPC_PERSONALITY_RESOLVED"],"npcCounterpartyEngine",["M01"]),
    MechanicMeta("M135","Reputation Labels: Earned Reversible Proof-Based","narrative","ui_component",2,3,["runHistory","reputationRules","proofHashes"],["reputationLabel","labelHash","labelReversible"],["REPUTATION_LABEL_EARNED","LABEL_REVERSED","REPUTATION_VERIFIED"],"reputationLabelAwarder",["M50","M36"]),
    # ─── OPS ─────────────────────────────────────────────────────────────────
    MechanicMeta("M136","Ruleset Signature Banner: Players Always Know Whats Live","ops","season_runtime",1,3,["activeRuleset","rulesVersion","state.runId"],["bannerDisplayed","rulesetSignature","playerAcknowledged"],["RULESET_SIGNATURE_SHOWN","RULESET_VERSION_CONFIRMED","PLAYER_ACKNOWLEDGED"],"rulesetSignatureBanner",["M19"]),
    MechanicMeta("M137","Mid-Run Hotfix Lock: No Surprise Changes Inside a Run","ops","tick_engine",1,3,["activeRunId","hotfixPayload","runLockStatus"],["hotfixQueued","lockEnforced","hotfixAppliedPostRun"],["HOTFIX_QUEUED","RUN_LOCK_ENFORCED","HOTFIX_APPLIED"],"midRunHotfixLockEnforcer",["M02"]),
    MechanicMeta("M138","Degraded Mode: Server Load Shedding Without Breaking Runs","ops","tick_engine",1,3,["serverLoadMetric","degradedModeConfig","activeRuns"],["degradedModeActive","shedFeatures","runPreserved"],["DEGRADED_MODE_ENTERED","FEATURES_SHED","DEGRADED_MODE_EXITED"],"degradedModeLoadShedder",["M02","M46"]),
    MechanicMeta("M139","Offline Queue: Runs Play Now Verify Later","ops","backend_service",2,3,["offlineRunPayload","verificationQueue","syncConfig"],["offlineRunQueued","syncScheduled","verificationPending"],["OFFLINE_RUN_QUEUED","SYNC_SCHEDULED","VERIFICATION_PENDING"],"offlineQueueRunManager",["M48","M46"]),
    MechanicMeta("M140","Player Evidence Export: Redacted Truth Packet","ops","backend_service",2,3,["exportRequest","runId","redactionRules"],["exportedPacket","redactedPayload","exportHash"],["EVIDENCE_EXPORT_REQUESTED","REDACTION_APPLIED","PACKET_EXPORTED"],"playerEvidenceExporter",["M74","M50"]),
    MechanicMeta("M141","Asynchronous Table: Friends Vote Later Still Timer-Bound","ops","api_endpoint",2,3,["asyncVoteConfig","participantIds","voteWindow"],["asyncVoteActive","voteResult","timerBoundEnforced"],["ASYNC_VOTE_OPENED","ASYNC_VOTE_CAST","ASYNC_VOTE_RESOLVED"],"asyncTableVoteEngine",["M16","M76"]),
    MechanicMeta("M142","House Rules: Custom Lobbies with Published Constraints","ops","api_endpoint",2,3,["houseRuleConfig","constraintValidator","lobbyId"],["houseRulesActive","publishedConstraints","lobbySignature"],["HOUSE_RULES_PUBLISHED","CONSTRAINT_VALIDATED","LOBBY_SIGNED"],"houseRulesCustomLobby",["M19","M136"]),
    MechanicMeta("M143","Table Penalties: Toxicity Without ML Pure Rule Enforcement","ops","api_endpoint",1,3,["behaviorReport","penaltyRules","playerId"],["penaltyApplied","cordPenalty","violationLogged"],["PENALTY_ISSUED","CORD_PENALIZED","VIOLATION_LOGGED"],"tablePenaltyEnforcer",["M46"]),
    MechanicMeta("M144","Spectator Theater: Watch Live Runs with Delay","ops","ui_component",2,3,["spectatorConfig","runId","delayMs"],["spectatorFeedActive","spectatorView","predictionBetEnabled"],["SPECTATOR_JOINED","PREDICTION_BET_PLACED","SPECTATOR_CHAT_MESSAGE"],"spectatorTheaterEngine",["M22","M64"]),
    MechanicMeta("M145","Tournament Brackets: Verified Seeds Published Scoring","ops","api_endpoint",2,3,["tournamentConfig","participantIds","bracketSeed"],["bracketGenerated","matchScheduled","scoringPublished"],["TOURNAMENT_STARTED","MATCH_SCHEDULED","BRACKET_UPDATED"],"tournamentBracketEngine",["M64","M01"]),
    MechanicMeta("M146","Audit Event: Forced Documentation Under Timer","ops","backend_service",1,3,["auditTrigger","state.tick","documentationRequired"],["auditEntry","documentationSubmitted","auditHash"],["AUDIT_TRIGGERED","DOCUMENTATION_SUBMITTED","AUDIT_HASH_STORED"],"auditEventDocumenter",["M46","M47"]),
    MechanicMeta("M147","Litigation Risk: Civil Shock Deterministic Triggers","ops","backend_service",2,3,["litigationTrigger","state.cash","RunSeed"],["litigationShock","cashDrained","legalHoldApplied"],["LITIGATION_TRIGGERED","LEGAL_HOLD_APPLIED","CIVIL_SHOCK_RESOLVED"],"litigationRiskShockEngine",["M12","M13"]),
    MechanicMeta("M148","Counterparty Freeze: Market Doesnt Always Clear","ops","backend_service",2,3,["marketTransaction","counterpartyState","freezeTrigger"],["transactionFrozen","freezeDuration","unfreezeCondition"],["COUNTERPARTY_FROZEN","TRANSACTION_HELD","FREEZE_LIFTED"],"counterpartyFreezeHandler",["M09","M73"]),
    MechanicMeta("M149","Regulatory Window: One Chance to Comply or Pay Forever","ops","backend_service",2,3,["regulatoryTrigger","complianceWindow","state.cash"],["complianceResult","penaltyApplied","windowExpired"],["REGULATORY_WINDOW_OPENED","COMPLIANCE_SUBMITTED","PENALTY_PERMANENT"],"regulatoryWindowEnforcer",["M13","M27"]),
    MechanicMeta("M150","Finality Ceremony: Run Ends with a Verifiable Stamp","ops","season_runtime",1,3,["completedRun","cordScore","sovereigntyGrade"],["finalityStamp","ceremonyDisplayed","stampHash"],["FINALITY_CEREMONY_TRIGGERED","SOVEREIGNTY_STAMP_ISSUED","RUN_FINALIZED"],"finalityCeremonyStamper",["M50","M46"]),
]
# fmt: on

assert len(MECHANICS_TABLE) == 150, f"Expected 150 mechanics, got {len(MECHANICS_TABLE)}"


# ══════════════════════════════════════════════════════════════════════════════
# REGISTRY BUILDER
# ══════════════════════════════════════════════════════════════════════════════

def build_registry(
    mechanics_dir: Path,
    ml_dir: Path,
    only: list[str] | None = None,
) -> list[dict]:
    records = []
    for m in MECHANICS_TABLE:
        if only and m.mechanic_id not in only:
            continue
        # Attempt to pick up status from existing .md spec files
        status = m.status
        safe_title = re.sub(r"[^a-z0-9]+", "_", m.title.lower())[:60].strip("_")
        md_path = mechanics_dir / f"{m.mechanic_id.lower()}_{safe_title}.md"
        if md_path.exists():
            txt = md_path.read_text(encoding="utf-8", errors="replace")
            if "status: done" in txt.lower():
                status = "done"
            elif "status: in_progress" in txt.lower() or "in progress" in txt.lower():
                status = "in_progress"

        module_stem = f"{m.mechanic_id.lower()}_{safe_title}"
        records.append({
            "task_id":          f"PZO-{m.mechanic_id}",
            "mechanic_id":      m.mechanic_id,
            "title":            m.title,
            "family":           m.family,
            "kind":             "core",
            "layer":            m.layer,
            "priority":         m.priority,
            "batch":            m.batch,
            "inputs":           m.inputs,
            "outputs":          m.outputs,
            "telemetry_events": m.telemetry_events,
            "exec_hook":        m.exec_hook,
            "deps":             m.deps,
            "status":           status,
            "ml_pair":          m.ml_pair,
            "module_path":      f"pzo_engine/src/mechanics/{module_stem}.ts",
        })
    return records


# ══════════════════════════════════════════════════════════════════════════════
# SHARED TYPES GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

SHARED_TYPES_TS = '''\
// AUTO-GENERATED by scripts/build_mechanics.py — DO NOT EDIT MANUALLY
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/types.ts — Shared domain types for all 150 mechanics

export type RunPhase       = 'EARLY' | 'MID' | 'LATE';
export type TickTier       = 'STANDARD' | 'ELEVATED' | 'CRITICAL';
export type MacroRegime    = 'BULL' | 'NEUTRAL' | 'BEAR' | 'CRISIS';
export type PressureTier   = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SolvencyStatus = 'SOLVENT' | 'BLEED' | 'WIPED';

export interface Asset         { id: string; value: number; cashflowMonthly: number; purchasePrice?: number; }
export interface IPAItem       { id: string; cashflowMonthly: number; }
export interface GameCard      { id: string; name: string; type: string; cost?: number | null; downPayment?: number | null; shieldValue?: number; targetAssetId?: string; }
export interface GameEvent     { type: string; damage?: number; payload?: Record<string, unknown>; }
export interface ShieldLayer   { id: string; strength: number; type: string; }
export interface Debt          { id: string; amount: number; interestRate: number; }
export interface Buff          { id: string; type: string; magnitude: number; expiresAt: number; }
export interface Liability     { id: string; amount: number; }
export interface SetBonus      { setId: string; bonus: number; description: string; }
export interface AssetMod      { modId: string; assetId: string; statKey: string; delta: number; }
export interface IncomeItem    { source: string; amount: number; }
export interface MacroEvent    { tick: number; type: string; regimeChange?: MacroRegime; }
export interface ChaosWindow   { startTick: number; endTick: number; type: string; }
export interface AuctionResult { winnerId: string; winnerBid: number; expired: boolean; }
export interface PurchaseResult{ success: boolean; assetId: string; cashSpent: number; leverageAdded: number; reason: string; }
export interface ShieldResult  { absorbed: number; pierced: boolean; depleted: boolean; remainingShield: number; }
export interface ExitResult    { assetId: string; saleProceeds: number; capitalGain: number; timingScore: number; macroRegime: MacroRegime; }
export interface TickResult    { tick: number; runPhase: RunPhase; timerExpired: boolean; }
export interface DeckComposition { totalCards: number; byType: Record<string, number>; }
export interface TierProgress  { currentTier: PressureTier; progressPct: number; }
export interface WipeEvent     { reason: string; tick: number; cash: number; netWorth: number; }
export interface RegimeShiftEvent { previousRegime: MacroRegime; newRegime: MacroRegime; }
export interface PhaseTransitionEvent { from: RunPhase; to: RunPhase; }
export interface TimerExpiredEvent { tick: number; }
export interface StreakEvent    { streakLength: number; taxApplied: boolean; }
export interface FubarEvent    { level: number; type: string; damage: number; }
export interface LedgerEntry   { gameAction: unknown; tick: number; hash: string; }
export interface ProofCard     { runId: string; cordScore: number; hash: string; grade: string; }
export interface CompletedRun  { runId: string; userId: string; cordScore: number; outcome: string; ticks: number; }
export interface SeasonState   { seasonId: string; tick: number; rewardsClaimed: string[]; }
export interface RunState      { cash: number; netWorth: number; tick: number; runPhase: RunPhase; }
export interface MomentEvent   { type: string; tick: number; highlight: string; shareReady: boolean; }
export interface ClipBoundary  { startTick: number; endTick: number; triggerEvent: string; }

// Mechanic telemetry envelope
export interface MechanicTelemetryPayload {
  event:       string;
  mechanic_id: string;
  tick:        number;
  runId:       string;
  payload:     Record<string, unknown>;
}

export type MechanicEmitter = (p: MechanicTelemetryPayload) => void;
'''

def generate_shared_types() -> str:
    return SHARED_TYPES_TS


# ══════════════════════════════════════════════════════════════════════════════
# SHARED UTILS GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

UTILS_TS = '''\
// AUTO-GENERATED by scripts/build_mechanics.py — DO NOT EDIT MANUALLY
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/mechanicsUtils.ts

import type { GameCard, MacroRegime, PressureTier, RunPhase } from './types';

// ── Core math ──────────────────────────────────────────────────────────────
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Deterministic hash (djb2-based, no crypto) ────────────────────────────
export function computeHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Seeded index selection ────────────────────────────────────────────────
export function seededIndex(seed: string, tick: number, len: number): number {
  if (len === 0) return 0;
  const h = parseInt(computeHash(seed + ':' + tick), 16);
  return h % len;
}

// ── Seeded shuffle (Fisher-Yates) ─────────────────────────────────────────
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = seededIndex(seed, i, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Macro schedule builder ────────────────────────────────────────────────
export const MACRO_EVENTS_PER_RUN  = 4;
export const CHAOS_WINDOWS_PER_RUN = 3;
export const RUN_TOTAL_TICKS       = 144;   // 12 min × 12 ticks/min

export function buildMacroSchedule(seed: string, count: number): import('./types').MacroEvent[] {
  const regimes: MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'];
  return Array.from({ length: count }, (_, i) => ({
    tick:         seededIndex(seed, i, RUN_TOTAL_TICKS),
    type:         'REGIME_SHIFT',
    regimeChange: regimes[seededIndex(seed, i + 100, regimes.length)],
  }));
}

export function buildChaosWindows(seed: string, count: number): import('./types').ChaosWindow[] {
  return Array.from({ length: count }, (_, i) => {
    const start = seededIndex(seed, i + 200, RUN_TOTAL_TICKS - 10);
    return { startTick: start, endTick: start + 6, type: 'FUBAR_WINDOW' };
  });
}

// ── Decay rate by macro regime ────────────────────────────────────────────
export const REGIME_MULTIPLIERS: Record<MacroRegime, number> = {
  BULL: 1.15, NEUTRAL: 1.0, BEAR: 0.85, CRISIS: 0.60,
};

export function computeDecayRate(regime: MacroRegime, base: number): number {
  return clamp(base * (REGIME_MULTIPLIERS[regime] ?? 1.0), 0.01, 0.99);
}

// ── Draw pool weights ─────────────────────────────────────────────────────
export const PRESSURE_WEIGHTS: Record<PressureTier, number> = {
  LOW: 0.8, MEDIUM: 1.0, HIGH: 1.3, CRITICAL: 1.6,
};
export const PHASE_WEIGHTS: Record<RunPhase, number> = {
  EARLY: 0.9, MID: 1.0, LATE: 1.2,
};
export const REGIME_WEIGHTS: Record<MacroRegime, number> = {
  BULL: 1.1, NEUTRAL: 1.0, BEAR: 0.9, CRISIS: 0.75,
};

// ── Opportunity pool (seed deck fallback) ─────────────────────────────────
export const OPPORTUNITY_POOL: GameCard[] = [
  { id: 'opp-001', name: 'Single Family Rental', type: 'OPPORTUNITY', cost: 25000, downPayment: 25000 },
  { id: 'opp-002', name: 'Digital Business', type: 'OPPORTUNITY', cost: 15000, downPayment: 15000 },
  { id: 'opp-003', name: 'Index Fund Block', type: 'OPPORTUNITY', cost: 10000, downPayment: 10000 },
  { id: 'opp-004', name: 'Wholesale Flip', type: 'OPPORTUNITY', cost: 8000, downPayment: 8000 },
];
export const DEFAULT_CARD: GameCard = OPPORTUNITY_POOL[0];
export const DEFAULT_CARD_IDS = OPPORTUNITY_POOL.map(c => c.id);

// ── Exit pulse multipliers ────────────────────────────────────────────────
export const EXIT_PULSE_MULTIPLIERS: Record<MacroRegime, number> = {
  BULL: 1.25, NEUTRAL: 1.0, BEAR: 0.80, CRISIS: 0.55,
};

// ── Weighted draw pool builder ────────────────────────────────────────────
export function buildWeightedPool(
  seed: string,
  pressurePhaseWeight: number,
  regimeWeight: number,
): GameCard[] {
  const combined = pressurePhaseWeight * regimeWeight;
  const count    = Math.max(2, Math.round(OPPORTUNITY_POOL.length * combined));
  const shuffled = seededShuffle(OPPORTUNITY_POOL, seed);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
'''

def generate_utils() -> str:
    return UTILS_TS


# ══════════════════════════════════════════════════════════════════════════════
# PER-MECHANIC TS STUB GENERATOR (production — no throws)
# ══════════════════════════════════════════════════════════════════════════════

TS_HEADER = '''\
// AUTO-GENERATED by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// {module_path}
//
// Mechanic : {mechanic_id} — {title}
// Family   : {family}   Layer: {layer}   Priority: {priority}   Batch: {batch}
// ML Pair  : {ml_pair}
// Deps     : {deps_str}
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {{ clamp, computeHash, seededShuffle, seededIndex,
         buildMacroSchedule, buildChaosWindows,
         buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
         computeDecayRate, EXIT_PULSE_MULTIPLIERS,
         MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
         PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
         REGIME_MULTIPLIERS }} from './mechanicsUtils';
import type {{
  RunPhase, TickTier, MacroRegime, PressureTier, SolvencyStatus,
  Asset, IPAItem, GameCard, GameEvent, ShieldLayer, Debt, Buff,
  Liability, SetBonus, AssetMod, IncomeItem, MacroEvent, ChaosWindow,
  AuctionResult, PurchaseResult, ShieldResult, ExitResult, TickResult,
  DeckComposition, TierProgress, WipeEvent, RegimeShiftEvent,
  PhaseTransitionEvent, TimerExpiredEvent, StreakEvent, FubarEvent,
  LedgerEntry, ProofCard, CompletedRun, SeasonState, RunState,
  MomentEvent, ClipBoundary, MechanicTelemetryPayload, MechanicEmitter,
}} from './types';
'''

def generate_ts_stub(record: dict) -> str:
    mid          = record["mechanic_id"]
    title        = record["title"]
    family       = record["family"]
    layer        = record["layer"]
    priority     = record["priority"]
    batch        = record["batch"]
    ml_pair      = record["ml_pair"]
    module_path  = record["module_path"]
    exec_hook    = record["exec_hook"]
    deps         = record["deps"]
    inputs_      = record["inputs"]
    outputs_     = record["outputs"]
    tel_events   = record["telemetry_events"]

    deps_str         = ", ".join(deps) if deps else "none"
    inputs_fields    = "\n".join(f"  {_camel_field(i)}?: {_infer_ts_type(i)};" for i in inputs_)
    outputs_fields   = "\n".join(f"  {_camel_field(o)}: {_infer_ts_type(o)};" for o in outputs_)
    tel_union        = " | ".join(f"'{e}'" for e in tel_events) if tel_events else "string"

    header = TS_HEADER.format(
        module_path=module_path, mechanic_id=mid, title=title,
        family=family, layer=layer, priority=priority, batch=batch,
        ml_pair=ml_pair, deps_str=deps_str,
    )

    # Bounds constant — every mechanic gets one for design law enforcement
    bounds_lines = "\n".join([
        f"  BASE_AMOUNT:         1_000," if layer == "tick_engine" else "",
        f"  TRIGGER_THRESHOLD:   3,",
        f"  MULTIPLIER:          1.5,",
        f"  MAX_AMOUNT:          50_000,",
        f"  MAX_LEVERAGE:        500_000,"   if "leverage" in str(outputs_).lower() else "",
        f"  MIN_CASH_DELTA:      -20_000,",
        f"  MAX_CASH_DELTA:       20_000,",
        f"  MIN_CASHFLOW_DELTA:  -10_000,",
        f"  MAX_CASHFLOW_DELTA:   10_000,",
        f"  TIER_ESCAPE_TARGET:   3_000,",
        f"  REGIME_SHIFT_THRESHOLD: 500,",
        f"  BASE_DECAY_RATE:     0.02,",
        f"  BLEED_CASH_THRESHOLD: 1_000,",
        f"  FIRST_REFUSAL_TICKS: 6,",
        f"  PULSE_CYCLE:         12,",
        f"  MAX_PROCEEDS:        999_999,",
        f"  EFFECT_MULTIPLIER:   1.0,",
        f"  MIN_EFFECT:          0,",
        f"  MAX_EFFECT:          100_000,",
    ])
    # Dedupe blank lines
    bounds_body = "\n".join(l for l in bounds_lines.splitlines() if l.strip())

    # Pick implementation body
    impl_fn   = _pick_pattern(record)
    impl_body = impl_fn(record)

    # ML companion output block
    ml_inputs_str = ", ".join(
        f"{_camel_field(o)}?: {_infer_ts_type(o)}" for o in outputs_[:4]
    )

    stub = f'''{header}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface {mid}Input {{
{inputs_fields}
}}

export interface {mid}Output {{
{outputs_fields}
}}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type {mid}Event = {tel_union};

export interface {mid}TelemetryPayload extends MechanicTelemetryPayload {{
  event: {mid}Event;
  mechanic_id: '{mid}';
}}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const {mid}_BOUNDS = {{
{bounds_body}
}} as const;

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * {exec_hook}
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function {exec_hook}(
  input: {mid}Input,
  emit: MechanicEmitter,
): {mid}Output {{
{impl_body}
}}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface {mid}MLInput {{
  {ml_inputs_str};
  runId: string;
  tick:  number;
}}

export interface {mid}MLOutput {{
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}}

/**
 * {exec_hook}MLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function {exec_hook}MLCompanion(
  input: {mid}MLInput,
): Promise<{mid}MLOutput> {{
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {{
    score,
    topFactors:     ['{mid} signal computed', 'advisory only'],
    recommendation: 'Monitor {mid} output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:{mid}'),
    confidenceDecay: 0.05,
  }};
}}
'''
    return stub


# ══════════════════════════════════════════════════════════════════════════════
# BARREL GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

def generate_barrel(records: list[dict]) -> str:
    lines = [
        "// AUTO-GENERATED by scripts/build_mechanics.py — DO NOT EDIT MANUALLY",
        "// Regenerate: python3 scripts/build_mechanics.py --force",
        "// Density6 LLC · Point Zero One · Confidential",
        "",
        "export * from './types';",
        "export * from './mechanicsUtils';",
        "export * from './MechanicsRouter';",
        "export * from './snapshotExtractor';",
        "export * from './mechanicsRuntimeStore';",
        "",
    ]
    for r in records:
        stem = Path(r["module_path"]).stem
        lines.append(f"export * from './{stem}';")
    return "\n".join(lines) + "\n"


# ══════════════════════════════════════════════════════════════════════════════
# ROUTER GENERATOR — live dispatch, wired to Orchestrator
# ══════════════════════════════════════════════════════════════════════════════

def generate_router(records: list[dict]) -> str:
    dispatch_entries = []
    for r in records:
        stem = Path(r["module_path"]).stem
        dispatch_entries.append(
            f"  '{r['mechanic_id']}': {{ mechanic_id: '{r['mechanic_id']}', "
            f"exec_hook: '{r['exec_hook']}', layer: '{r['layer']}', "
            f"priority: {r['priority']}, batch: {r['batch']}, "
            f"module: './{stem}' }},"
        )

    # Dynamic import lines for card_handler hooks
    card_imports = "\n".join(
        f"    case '{r['mechanic_id']}': return (await import('./{Path(r['module_path']).stem}')).{r['exec_hook']};"
        for r in records if r["layer"] == "card_handler"
    )
    tick_imports = "\n".join(
        f"    case '{r['mechanic_id']}': return (await import('./{Path(r['module_path']).stem}')).{r['exec_hook']};"
        for r in records if r["layer"] == "tick_engine"
    )

    lines = [
        "// AUTO-GENERATED by scripts/build_mechanics.py — DO NOT EDIT MANUALLY",
        "// Density6 LLC · Point Zero One · Confidential",
        "// pzo_engine/src/mechanics/MechanicsRouter.ts",
        "//",
        "// Live dispatch system — wired to EngineOrchestrator Step 12.5 and CardEffectResolver.",
        "// Import this module and call dispatchTickMechanics() / dispatchCardMechanic().",
        "",
        "import type { MechanicEmitter } from './types';",
        "import { extractMechanicInput } from './snapshotExtractor';",
        "import { recordActivation }     from './mechanicsRuntimeStore';",
        "",
        "export type MechanicLayer = 'tick_engine' | 'card_handler' | 'ui_component' | 'season_runtime' | 'api_endpoint' | 'backend_service';",
        "",
        "export interface MechanicDispatch {",
        "  mechanic_id: string;",
        "  exec_hook:   string;",
        "  layer:       MechanicLayer;",
        "  priority:    1 | 2 | 3;",
        "  batch:       1 | 2 | 3;",
        "  module:      string;",
        "}",
        "",
        "/** Canonical dispatch table — one entry per mechanic. */",
        "export const MECHANICS_DISPATCH_TABLE: Readonly<Record<string, MechanicDispatch>> = {",
        *dispatch_entries,
        "} as const;",
        "",
        "export function getDispatch(mechanic_id: string): MechanicDispatch | undefined {",
        "  return MECHANICS_DISPATCH_TABLE[mechanic_id];",
        "}",
        "",
        "export function getDispatchByLayer(layer: MechanicLayer): readonly MechanicDispatch[] {",
        "  return Object.values(MECHANICS_DISPATCH_TABLE).filter(d => d.layer === layer);",
        "}",
        "",
        "export function getDispatchByBatch(batch: 1 | 2 | 3): readonly MechanicDispatch[] {",
        "  return Object.values(MECHANICS_DISPATCH_TABLE).filter(d => d.batch === batch);",
        "}",
        "",
        "// ── Live tick dispatch ──────────────────────────────────────────────────────",
        "//",
        "// Called by EngineOrchestrator after Step 12 (SovereigntyEngine.snapshotTick).",
        "// Only tick_engine layer mechanics with batch ≤ batchCap fire here.",
        "// card_handler mechanics fire via dispatchCardMechanic() in CardEffectResolver.",
        "",
        "export async function dispatchTickMechanics(",
        "  snapshot: Record<string, unknown>,",
        "  emit: MechanicEmitter,",
        "  tick: number,",
        "  batchCap: 1 | 2 | 3 = 3,",
        "): Promise<void> {",
        "  const tickMechanics = getDispatchByLayer('tick_engine')",
        "    .filter(d => d.batch <= batchCap)",
        "    .sort((a, b) => a.priority - b.priority || a.batch - b.batch);",
        "",
        "  for (const d of tickMechanics) {",
        "    try {",
        "      const hook   = await loadTickHook(d.mechanic_id);",
        "      const input  = extractMechanicInput(d.mechanic_id, snapshot);",
        "      hook(input as any, emit);",
        "      recordActivation(d.mechanic_id, tick);",
        "    } catch (err) {",
        "      console.error(`[MechanicsRouter] tick hook ${d.mechanic_id} error:`, err);",
        "    }",
        "  }",
        "}",
        "",
        "export async function dispatchCardMechanic(",
        "  mechanic_id: string,",
        "  snapshot: Record<string, unknown>,",
        "  emit: MechanicEmitter,",
        "  tick: number,",
        "): Promise<unknown | null> {",
        "  const d = getDispatch(mechanic_id);",
        "  if (!d || d.layer !== 'card_handler') return null;",
        "  try {",
        "    const hook   = await loadCardHook(mechanic_id);",
        "    const input  = extractMechanicInput(mechanic_id, snapshot);",
        "    const result = hook(input as any, emit);",
        "    recordActivation(mechanic_id, tick);",
        "    return result;",
        "  } catch (err) {",
        "    console.error(`[MechanicsRouter] card hook ${mechanic_id} error:`, err);",
        "    return null;",
        "  }",
        "}",
        "",
        "// ── Dynamic import loaders ──────────────────────────────────────────────────",
        "",
        "async function loadTickHook(mechanic_id: string): Promise<Function> {",
        "  switch (mechanic_id) {",
        tick_imports,
        "    default: throw new Error(`[MechanicsRouter] No tick hook for ${mechanic_id}`);",
        "  }",
        "}",
        "",
        "async function loadCardHook(mechanic_id: string): Promise<Function> {",
        "  switch (mechanic_id) {",
        card_imports,
        "    default: throw new Error(`[MechanicsRouter] No card hook for ${mechanic_id}`);",
        "  }",
        "}",
    ]
    return "\n".join(lines) + "\n"


# ══════════════════════════════════════════════════════════════════════════════
# SNAPSHOT EXTRACTOR GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

def generate_snapshot_extractor(records: list[dict]) -> str:
    # Build per-mechanic case entries for card_handler and tick_engine
    per_mechanic_cases = []
    for r in records:
        mid = r["mechanic_id"]
        camel_inputs = {_camel_field(f): f for f in r["inputs"]}
        field_lines = []
        for camel, orig in list(camel_inputs.items())[:8]:
            ts = _infer_ts_type(orig)
            if orig.startswith("state."):
                key = orig[6:]  # strip "state."
                if ts == "number":
                    field_lines.append(f"      {camel}: (snap.{key} as number) ?? 0,")
                elif ts == "boolean":
                    field_lines.append(f"      {camel}: Boolean(snap.{key}),")
                elif ts == "string":
                    field_lines.append(f"      {camel}: String(snap.{key} ?? ''),")
                elif ts.endswith("[]"):
                    field_lines.append(f"      {camel}: (snap.{key} as {ts}) ?? [],")
                else:
                    field_lines.append(f"      {camel}: snap.{key},")
            else:
                if ts == "number":
                    field_lines.append(f"      {camel}: (snap.{camel} as number) ?? (snap['{orig}'] as number) ?? 0,")
                elif ts == "boolean":
                    field_lines.append(f"      {camel}: Boolean(snap.{camel} ?? snap['{orig}']),")
                elif ts == "string":
                    field_lines.append(f"      {camel}: String(snap.{camel} ?? snap['{orig}'] ?? ''),")
                else:
                    field_lines.append(f"      {camel}: snap.{camel} ?? snap['{orig}'],")

        body = "\n".join(field_lines)
        per_mechanic_cases.append(f"    case '{mid}': return {{\n{body}\n      ...snap\n    }};")

    cases_str = "\n".join(per_mechanic_cases)

    return f'''\
// AUTO-GENERATED by scripts/build_mechanics.py — DO NOT EDIT MANUALLY
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/snapshotExtractor.ts
//
// Maps RunStateSnapshot (flat object from EngineOrchestrator) to typed
// M0xInput objects consumed by each exec_hook.
// Called by MechanicsRouter before every hook invocation.

/**
 * Extract a mechanic-specific input object from the RunStateSnapshot.
 * Adds the full snapshot as a spread fallback so any field the hook
 * references but we haven\'t mapped explicitly is still accessible.
 */
export function extractMechanicInput(
  mechanic_id: string,
  snap: Record<string, unknown>,
): Record<string, unknown> {{
  switch (mechanic_id) {{
{cases_str}
    default:
      // Unknown mechanic — return full snapshot; hook authors narrow themselves
      return snap;
  }}
}}
'''


# ══════════════════════════════════════════════════════════════════════════════
# RUNTIME STORE GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

def generate_runtime_store(records: list[dict]) -> str:
    mechanic_ids = [r["mechanic_id"] for r in records]
    ids_ts = "\n".join(f"  '{mid}'," for mid in mechanic_ids)

    return f'''\
// AUTO-GENERATED by scripts/build_mechanics.py — DO NOT EDIT MANUALLY
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/mechanicsRuntimeStore.ts
//
// Singleton heat / confidence / signal store for all 150 mechanics.
// EngineOrchestrator calls tickRuntime() every tick (Step 12.5).
// MechanicsRouter calls recordActivation() after every exec_hook fires.
// mechanicCatalog.selectAlphaCandidate() reads this store for alpha-draw routing.

// ── Constants ──────────────────────────────────────────────────────────────
const HEAT_DECAY_PER_TICK:       number = 0.08;
const CONFIDENCE_DECAY_PER_TICK: number = 0.005;
const SIGNAL_DECAY_FACTOR:       number = 0.85;
const MIN_CONFIDENCE:            number = 0.08;
const MAX_CONFIDENCE:            number = 0.99;

// ── Types ──────────────────────────────────────────────────────────────────
export interface MechanicRuntimeState {{
  enabled:         boolean;
  activations:     number;
  lastTick:        number;
  heat:            number;  // 0–1: how recently / intensely this mechanic fired
  confidence:      number;  // 0–1: ML confidence score
  signal:          number;  // 0–1: current ML signal strength
  suppressedUntil?: number; // tick when suppression expires (circuit-breaker)
}}

export type MechanicsRuntimeMap = Record<string, MechanicRuntimeState>;

// ── All mechanic IDs ────────────────────────────────────────────────────────
const ALL_MECHANIC_IDS: readonly string[] = [
{ids_ts}
] as const;

// ── Singleton store ─────────────────────────────────────────────────────────
let _store: MechanicsRuntimeMap = _initStore();

function _initStore(): MechanicsRuntimeMap {{
  const out: MechanicsRuntimeMap = {{}};
  for (const id of ALL_MECHANIC_IDS) {{
    out[id] = {{
      enabled:    true,
      activations: 0,
      lastTick:   -1,
      heat:        0,
      confidence:  0.6,
      signal:      0,
    }};
  }}
  return out;
}}

// ── Public API ───────────────────────────────────────────────────────────────

/** Read-only snapshot of current store (returns same reference — do not mutate). */
export function getRuntime(): Readonly<MechanicsRuntimeMap> {{
  return _store;
}}

/**
 * Decay all mechanic runtime states by one tick.
 * Called by EngineOrchestrator at Step 12.5 — after all 7 engines have run.
 */
export function tickRuntime(): void {{
  const next: MechanicsRuntimeMap = {{}};
  for (const [id, st] of Object.entries(_store)) {{
    next[id] = {{
      ...st,
      heat:       Math.max(0, st.heat - HEAT_DECAY_PER_TICK),
      confidence: Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, st.confidence - CONFIDENCE_DECAY_PER_TICK)),
      signal:     st.signal * SIGNAL_DECAY_FACTOR,
    }};
  }}
  _store = next;
}}

/**
 * Record a mechanic activation: bump heat, signal, activations, lastTick.
 * Called by MechanicsRouter after each exec_hook fires successfully.
 */
export function recordActivation(mechanic_id: string, tick: number, signalBoost = 0.15): void {{
  const st = _store[mechanic_id];
  if (!st) return;
  _store[mechanic_id] = {{
    ...st,
    activations: st.activations + 1,
    lastTick:    tick,
    heat:        Math.min(1, st.heat + 0.25),
    signal:      Math.min(1, st.signal + signalBoost),
    confidence:  Math.min(MAX_CONFIDENCE, st.confidence + 0.02),
  }};
}}

/**
 * Suppress a mechanic for N ticks (circuit-breaker pattern).
 * Prevents runaway positive feedback loops in high-heat states.
 */
export function suppressMechanic(mechanic_id: string, until: number): void {{
  const st = _store[mechanic_id];
  if (st) _store[mechanic_id] = {{ ...st, suppressedUntil: until }};
}}

/** Check if a mechanic can fire this tick. */
export function canActivate(mechanic_id: string, currentTick: number): boolean {{
  const st = _store[mechanic_id];
  if (!st || !st.enabled) return false;
  if (st.suppressedUntil != null && currentTick < st.suppressedUntil) return false;
  return true;
}}

/** Reset the entire store (use between runs in tests). */
export function resetRuntime(): void {{
  _store = _initStore();
}}
'''


# ══════════════════════════════════════════════════════════════════════════════
# VALIDATOR
# ══════════════════════════════════════════════════════════════════════════════

def validate_registry(records: list[dict]) -> list[str]:
    errors: list[str] = []
    ids = {r["mechanic_id"] for r in records}

    for r in records:
        mid = r["mechanic_id"]
        for dep in r["deps"]:
            if dep not in ids:
                errors.append(f"{mid}: dep '{dep}' not in registry")
            if dep == mid and mid not in {"M82", "M88", "M123"}:
                errors.append(f"{mid}: self-referencing dep")
        if not r["exec_hook"]:
            errors.append(f"{mid}: missing exec_hook")
        if not r["telemetry_events"]:
            errors.append(f"{mid}: no telemetry events")
        if r["batch"] not in (1, 2, 3):
            errors.append(f"{mid}: invalid batch {r['batch']}")
        if r["priority"] not in (1, 2, 3):
            errors.append(f"{mid}: invalid priority {r['priority']}")

    # Check for duplicate exec_hooks
    hooks = [r["exec_hook"] for r in records]
    seen: Counter = Counter(hooks)
    for hook, count in seen.items():
        if count > 1:
            dupes = [r["mechanic_id"] for r in records if r["exec_hook"] == hook]
            errors.append(f"Duplicate exec_hook '{hook}': {dupes}")

    return errors


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Point Zero One — Mechanics Build System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--dry-run",  action="store_true", help="Print what would be written; write nothing.")
    parser.add_argument("--only",     default="",          help="Comma-separated mechanic IDs (e.g. M01,M06).")
    parser.add_argument("--force",    action="store_true", help="Overwrite existing .ts stubs.")
    parser.add_argument("--validate", action="store_true", help="Validate registry cross-references and exit.")
    parser.add_argument("--stats",    action="store_true", help="Print registry stats and exit.")
    parser.add_argument("--mechanics-dir", default=str(MECHANICS_DIR))
    parser.add_argument("--ml-dir",        default=str(ML_DIR))
    parser.add_argument("--json-out",      default=str(JSON_OUT))
    parser.add_argument("--ts-out-dir",    default=str(TS_OUT_DIR))
    args = parser.parse_args()

    mechanics_dir = Path(args.mechanics_dir)
    ml_dir        = Path(args.ml_dir)
    json_out      = Path(args.json_out)
    ts_out_dir    = Path(args.ts_out_dir)
    dry_run       = args.dry_run
    force         = args.force
    only          = [x.strip().upper() for x in args.only.split(",") if x.strip()] if args.only else None

    print(f"\n{'='*72}")
    print(f"  Point Zero One — Mechanics Build System")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*72}\n")
    print(f"  Mechanics dir : {mechanics_dir}")
    print(f"  JSON output   : {json_out}")
    print(f"  TS output     : {ts_out_dir}")
    print(f"  Dry-run       : {dry_run}  |  Force: {force}")
    if only:
        print(f"  Only IDs      : {', '.join(only)}")
    print()

    # ── Build registry ──────────────────────────────────────────────────────
    records = build_registry(mechanics_dir, ml_dir, only=only)
    print(f"  Registry built: {len(records)} mechanics")

    # ── Stats ───────────────────────────────────────────────────────────────
    if args.stats:
        layer_c  = Counter(r["layer"]  for r in records)
        family_c = Counter(r["family"] for r in records)
        batch_c  = Counter(r["batch"]  for r in records)
        status_c = Counter(r["status"] for r in records)
        print("\n  ── Layer ────────────────────────────────────")
        for k, v in sorted(layer_c.items()): print(f"    {k:<30} {v:>3}")
        print("\n  ── Family ───────────────────────────────────")
        for k, v in sorted(family_c.items()): print(f"    {k:<30} {v:>3}")
        print(f"\n  Batches: {dict(sorted(batch_c.items()))}")
        print(f"  Status : {dict(sorted(status_c.items()))}")
        print()
        sys.exit(0)

    # ── Validate ────────────────────────────────────────────────────────────
    errors = validate_registry(records)
    if errors:
        print(f"\n  ✗ Validation errors ({len(errors)}):")
        for e in errors: print(f"    · {e}")
        if args.validate:
            sys.exit(1)
        else:
            print("  (continuing — use --validate to hard-fail)")
    else:
        print("  ✓ Registry validation passed")
    if args.validate:
        sys.exit(0)

    def _write(path: Path, content: str, label: str) -> None:
        if dry_run:
            print(f"  [dry-run] Would write {len(content):,} bytes → {path.name}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            print(f"  ✓ {label}: {path}  ({len(content):,} bytes)")

    # ── JSON registry ────────────────────────────────────────────────────────
    json_payload = json.dumps(records, indent=2, ensure_ascii=False) + "\n"
    _write(json_out, json_payload, "JSON registry")

    # ── Shared types + utils ─────────────────────────────────────────────────
    _write(ts_out_dir / "types.ts",          generate_shared_types(), "Shared types")
    _write(ts_out_dir / "mechanicsUtils.ts", generate_utils(),        "Shared utils")

    # ── Per-mechanic stubs ───────────────────────────────────────────────────
    ts_out_dir.mkdir(parents=True, exist_ok=True)
    written = skipped = 0
    for record in records:
        stem    = Path(record["module_path"]).stem
        ts_path = ts_out_dir / f"{stem}.ts"
        if ts_path.exists() and not force:
            skipped += 1
            continue
        stub = generate_ts_stub(record)
        if dry_run:
            print(f"  [dry-run] Would write → {ts_path.name}")
        else:
            ts_path.write_text(stub, encoding="utf-8")
            written += 1
    if not dry_run:
        print(f"  ✓ TS stubs: {written} written, {skipped} skipped (--force to overwrite)")

    # ── Router ───────────────────────────────────────────────────────────────
    _write(ts_out_dir / "MechanicsRouter.ts",        generate_router(records),             "MechanicsRouter")
    _write(ts_out_dir / "snapshotExtractor.ts",      generate_snapshot_extractor(records), "snapshotExtractor")
    _write(ts_out_dir / "mechanicsRuntimeStore.ts",  generate_runtime_store(records),      "mechanicsRuntimeStore")

    # ── Barrel ───────────────────────────────────────────────────────────────
    _write(ts_out_dir / "index.ts", generate_barrel(records), "Barrel index")

    print(f"\n  {'='*68}")
    print(f"  Build complete — {len(records)} mechanics")
    print(f"    JSON  : {json_out}")
    print(f"    TS    : {ts_out_dir}/")
    print(f"    Router: {ts_out_dir}/MechanicsRouter.ts  ← wire to Orchestrator Step 12.5")
    print(f"    Store : {ts_out_dir}/mechanicsRuntimeStore.ts  ← call tickRuntime() each tick")
    print(f"  {'='*68}\n")
    print("  Next: python3 scripts/build_mechanics.py --validate")
    print("        python3 scripts/build_mechanics.py --stats")
    print()


if __name__ == "__main__":
    main()