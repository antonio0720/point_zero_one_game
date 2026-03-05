import type { Asset, IPAItem, ShieldLayer, SetBonus, AssetMod, Liability } from './types';

// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT MANUALLY
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/snapshotExtractor.ts
//
// Maps RunStateSnapshot (flat object from EngineOrchestrator) to typed
// M0xInput objects consumed by each exec_hook.
// Called by MechanicsRouter before every hook invocation.

/**
 * Extract a mechanic-specific input object from the RunStateSnapshot.
 * Adds the full snapshot as a spread fallback so any field the hook
 * references but we haven't mapped explicitly is still accessible.
 */
export function extractMechanicInput(
  mechanic_id: string,
  snap: Record<string, unknown>,
): Record<string, unknown> {
  switch (mechanic_id) {
    case 'M01': return {
      userId: String(snap.userId ?? snap['userId'] ?? ''),
      rulesVersion: String(snap.rulesVersion ?? snap['rulesVersion'] ?? ''),
      timestamp: (snap.timestamp as number) ?? (snap['timestamp'] as number) ?? 0,
      ...snap
    };
    case 'M02': return {
      stateTick: (snap.tick as number) ?? 0,
      stateRunPhase: snap.runPhase,
      stateTickTier: snap.tickTier,
      ...snap
    };
    case 'M03': return {
      stateCash: (snap.cash as number) ?? 0,
      stateNetWorth: (snap.netWorth as number) ?? 0,
      stateCashflow: (snap.cashflow as number) ?? 0,
      stateTick: (snap.tick as number) ?? 0,
      ...snap
    };
    case 'M04': return {
      stateRunPhase: snap.runPhase,
      stateMacroRegime: snap.macroRegime,
      statePressureTier: snap.pressureTier,
      runSeed: String(snap.runSeed ?? snap['RunSeed'] ?? ''),
      ...snap
    };
    case 'M05': return {
      stateMacroRegime: snap.macroRegime,
      stateCash: (snap.cash as number) ?? 0,
      stateCashflow: (snap.cashflow as number) ?? 0,
      stateIncome: (snap.income as number) ?? 0,
      stateExpenses: (snap.expenses as number) ?? 0,
      ...snap
    };
    case 'M06': return {
      stateAssets: (snap.assets as Asset[]) ?? [],
      stateIpaItems: (snap.ipaItems as IPAItem[]) ?? [],
      stateTick: (snap.tick as number) ?? 0,
      stateMacroRegime: snap.macroRegime,
      ...snap
    };
    case 'M07': return {
      cardPlayed: snap.cardPlayed ?? snap['cardPlayed'],
      stateCash: (snap.cash as number) ?? 0,
      stateLeverage: (snap.leverage as number) ?? 0,
      stateMacroRegime: snap.macroRegime,
      ...snap
    };
    case 'M08': return {
      incomingEvent: snap.incomingEvent ?? snap['incomingEvent'],
      stateShieldLayers: (snap.shieldLayers as ShieldLayer[]) ?? [],
      cardPlayed: snap.cardPlayed ?? snap['cardPlayed'],
      ...snap
    };
    case 'M09': return {
      stateTick: (snap.tick as number) ?? 0,
      runSeed: String(snap.runSeed ?? snap['RunSeed'] ?? ''),
      stateMacroRegime: snap.macroRegime,
      auctionWindow: snap.auctionWindow ?? snap['auctionWindow'],
      ...snap
    };
    case 'M10': return {
      stateAssets: (snap.assets as Asset[]) ?? [],
      stateMacroRegime: snap.macroRegime,
      exitCard: snap.exitCard ?? snap['exitCard'],
      stateTick: (snap.tick as number) ?? 0,
      ...snap
    };
    case 'M11': return {
      stateMissedOpportunityCount: (snap.missedOpportunityCount as number) ?? 0,
      stateTick: (snap.tick as number) ?? 0,
      statePressureTier: snap.pressureTier,
      ...snap
    };
    case 'M12': return {
      fateTick: (snap.fateTick as number) ?? (snap['fateTick'] as number) ?? 0,
      statePressureTier: snap.pressureTier,
      stateCash: (snap.cash as number) ?? 0,
      ...snap
    };
    case 'M13': return {
      fateTick: (snap.fateTick as number) ?? (snap['fateTick'] as number) ?? 0,
      stateCash: (snap.cash as number) ?? 0,
      stateMacroRegime: snap.macroRegime,
      ...snap
    };
    case 'M14': return {
      playerSelection: snap.playerSelection ?? snap['playerSelection'],
      handicapOptions: snap.handicapOptions ?? snap['handicapOptions'],
      ...snap
    };
    case 'M15': return {
      friendInvitePayload: snap.friendInvitePayload ?? snap['friendInvitePayload'],
      stateTick: (snap.tick as number) ?? 0,
      ...snap
    };
    case 'M16': return {
      tableVoteRequest: snap.tableVoteRequest ?? snap['tableVoteRequest'],
      stateTick: (snap.tick as number) ?? 0,
      ...snap
    };
    case 'M17': return {
      stateCash: (snap.cash as number) ?? 0,
      stateTick: (snap.tick as number) ?? 0,
      ...snap
    };
    case 'M18': return {
      rivalId: String(snap.rivalId ?? snap['rivalId'] ?? ''),
      sabotageCard: snap.sabotageCard ?? snap['sabotageCard'],
      ...snap
    };
    case 'M19': return {
      seasonConfig: snap.seasonConfig ?? snap['seasonConfig'],
      stateSeasonState: snap.seasonState,
      ...snap
    };
    case 'M20': return {
      stateTick: (snap.tick as number) ?? 0,
      runSeed: String(snap.runSeed ?? snap['RunSeed'] ?? ''),
      ...snap
    };
    case 'M21': return {
      playerProfile: snap.playerProfile ?? snap['playerProfile'],
      completedRunCount: (snap.completedRunCount as number) ?? (snap['completedRunCount'] as number) ?? 0,
      ...snap
    };
    case 'M22': return {
      stateTick: (snap.tick as number) ?? 0,
      eventStream: snap.eventStream ?? snap['eventStream'],
      ...snap
    };
    case 'M23': return {
      clipBoundary: snap.clipBoundary ?? snap['clipBoundary'],
      runSnapshot: snap.runSnapshot ?? snap['runSnapshot'],
      ...snap
    };
    case 'M24': return {
      runId: String(snap.runId ?? snap['runId'] ?? ''),
      seed: String(snap.seed ?? snap['seed'] ?? ''),
      ...snap
    };
    case 'M25': return {
      runHistory: snap.runHistory ?? snap['runHistory'],
      currentRunState: snap.currentRunState ?? snap['currentRunState'],
      ...snap
    };
    case 'M26': return {
      contractDraft: snap.contractDraft ?? snap['contractDraft'],
      participantIds: snap.participantIds ?? snap['participantIds'],
      ...snap
    };
    case 'M27': return {
      contractId: String(snap.contractId ?? snap['contractId'] ?? ''),
      clauseDefinitions: snap.clauseDefinitions ?? snap['clauseDefinitions'],
      ...snap
    };
    case 'M28': return {
      proposalPayload: snap.proposalPayload ?? snap['proposalPayload'],
      windowDuration: (snap.windowDuration as number) ?? (snap['windowDuration'] as number) ?? 0,
      ...snap
    };
    case 'M29': return {
      poolContributions: snap.poolContributions ?? snap['poolContributions'],
      riskEvent: snap.riskEvent ?? snap['riskEvent'],
      ...snap
    };
    case 'M30': return {
      contractId: String(snap.contractId ?? snap['contractId'] ?? ''),
      defectionTrigger: snap.defectionTrigger ?? snap['defectionTrigger'],
      ...snap
    };
    case 'M31': return {
      stateAssets: (snap.assets as Asset[]) ?? [],
      synergyDefinitions: snap.synergyDefinitions ?? snap['synergyDefinitions'],
      ...snap
    };
    case 'M32': return {
      stateAssets: (snap.assets as Asset[]) ?? [],
      stateCash: (snap.cash as number) ?? 0,
      ...snap
    };
    case 'M33': return {
      stateAssets: (snap.assets as Asset[]) ?? [],
      hedgePairDefinitions: snap.hedgePairDefinitions ?? snap['hedgePairDefinitions'],
      ...snap
    };
    case 'M34': return {
      assetId: String(snap.assetId ?? snap['assetId'] ?? ''),
      modCard: snap.modCard ?? snap['modCard'],
      ...snap
    };
    case 'M35': return {
      stateAssets: (snap.assets as Asset[]) ?? [],
      exposureThresholds: snap.exposureThresholds ?? snap['exposureThresholds'],
      ...snap
    };
    case 'M36': return {
      completedRun: snap.completedRun ?? snap['completedRun'],
      achievementDefinitions: snap.achievementDefinitions ?? snap['achievementDefinitions'],
      ...snap
    };
    case 'M37': return {
      runResults: snap.runResults ?? snap['runResults'],
      streakCount: (snap.streakCount as number) ?? (snap['streakCount'] as number) ?? 0,
      ...snap
    };
    case 'M38': return {
      activeQuests: Boolean(snap.activeQuests ?? snap['activeQuests']),
      momentEvent: snap.momentEvent ?? snap['momentEvent'],
      ...snap
    };
    case 'M39': return {
      completedRun: snap.completedRun ?? snap['completedRun'],
      cordScore: (snap.cordScore as number) ?? (snap['cordScore'] as number) ?? 0,
      ...snap
    };
    case 'M40': return {
      trophyCurrency: (snap.trophyCurrency as number) ?? (snap['trophyCurrency'] as number) ?? 0,
      cosmeticRecipe: snap.cosmeticRecipe ?? snap['cosmeticRecipe'],
      ...snap
    };
    case 'M41': return {
      newPlayerFlag: Boolean(snap.newPlayerFlag ?? snap['newPlayerFlag']),
      onboardingConfig: snap.onboardingConfig ?? snap['onboardingConfig'],
      ...snap
    };
    case 'M42': return {
      playerOptIn: Boolean(snap.playerOptIn ?? snap['playerOptIn']),
      gameState: snap.gameState ?? snap['gameState'],
      ...snap
    };
    case 'M43': return {
      sandboxState: snap.sandboxState ?? snap['sandboxState'],
      rewindTarget: snap.rewindTarget ?? snap['rewindTarget'],
      ...snap
    };
    case 'M44': return {
      archetypeSelection: String(snap.archetypeSelection ?? snap['archetypeSelection'] ?? ''),
      playerProfile: snap.playerProfile ?? snap['playerProfile'],
      ...snap
    };
    case 'M45': return {
      runCount: (snap.runCount as number) ?? (snap['runCount'] as number) ?? 0,
      playerSkillScore: (snap.playerSkillScore as number) ?? (snap['playerSkillScore'] as number) ?? 0,
      ...snap
    };
    case 'M46': return {
      gameAction: snap.gameAction ?? snap['gameAction'],
      stateTick: (snap.tick as number) ?? 0,
      ...snap
    };
    case 'M47': return {
      clientAction: snap.clientAction ?? snap['clientAction'],
      sessionToken: String(snap.sessionToken ?? snap['sessionToken'] ?? ''),
      ...snap
    };
    case 'M48': return {
      runId: String(snap.runId ?? snap['runId'] ?? ''),
      seed: String(snap.seed ?? snap['seed'] ?? ''),
      ...snap
    };
    case 'M49': return {
      suspiciousPattern: snap.suspiciousPattern ?? snap['suspiciousPattern'],
      exploitTaxonomy: snap.exploitTaxonomy ?? snap['exploitTaxonomy'],
      ...snap
    };
    case 'M50': return {
      completedRun: snap.completedRun ?? snap['completedRun'],
      cordScore: (snap.cordScore as number) ?? (snap['cordScore'] as number) ?? 0,
      ...snap
    };
    case 'M51': return {
      dealProposal: snap.dealProposal ?? snap['dealProposal'],
      participantIds: snap.participantIds ?? snap['participantIds'],
      ...snap
    };
    case 'M52': return {
      escrowAmount: (snap.escrowAmount as number) ?? (snap['escrowAmount'] as number) ?? 0,
      milestoneConditions: snap.milestoneConditions ?? snap['milestoneConditions'],
      ...snap
    };
    case 'M53': return {
      reputationScore: (snap.reputationScore as number) ?? (snap['reputationScore'] as number) ?? 0,
      stakeAmount: (snap.stakeAmount as number) ?? (snap['stakeAmount'] as number) ?? 0,
      ...snap
    };
    case 'M54': return {
      contractId: String(snap.contractId ?? snap['contractId'] ?? ''),
      restructureProposal: snap.restructureProposal ?? snap['restructureProposal'],
      ...snap
    };
    case 'M55': return {
      disputePayload: snap.disputePayload ?? snap['disputePayload'],
      contractId: String(snap.contractId ?? snap['contractId'] ?? ''),
      ...snap
    };
    case 'M56': return {
      doctrineSelection: snap.doctrineSelection ?? snap['doctrineSelection'],
      stateAssets: (snap.assets as Asset[]) ?? [],
      ...snap
    };
    case 'M57': return {
      stateAssets: (snap.assets as Asset[]) ?? [],
      rebalanceWindow: snap.rebalanceWindow ?? snap['rebalanceWindow'],
      ...snap
    };
    case 'M58': return {
      stressTestConfig: snap.stressTestConfig ?? snap['stressTestConfig'],
      stateAssets: (snap.assets as Asset[]) ?? [],
      ...snap
    };
    case 'M59': return {
      stateActiveSetBonuses: (snap.activeSetBonuses as SetBonus[]) ?? [],
      stateAssetMods: (snap.assetMods as AssetMod[]) ?? [],
      ...snap
    };
    case 'M60': return {
      stateLiabilities: (snap.liabilities as Liability[]) ?? [],
      stateAssets: (snap.assets as Asset[]) ?? [],
      ...snap
    };
    case 'M61': return {
      cordScore: (snap.cordScore as number) ?? (snap['cordScore'] as number) ?? 0,
      runCount: (snap.runCount as number) ?? (snap['runCount'] as number) ?? 0,
      ...snap
    };
    case 'M62': return {
      coopRunResult: snap.coopRunResult ?? snap['coopRunResult'],
      contractId: String(snap.contractId ?? snap['contractId'] ?? ''),
      ...snap
    };
    case 'M63': return {
      bountyFunding: (snap.bountyFunding as number) ?? (snap['bountyFunding'] as number) ?? 0,
      bountyCriteria: snap.bountyCriteria ?? snap['bountyCriteria'],
      ...snap
    };
    case 'M64': return {
      completedRun: snap.completedRun ?? snap['completedRun'],
      proofHash: String(snap.proofHash ?? snap['proofHash'] ?? ''),
      ...snap
    };
    case 'M65': return {
      trophyEarnedCount: (snap.trophyEarnedCount as number) ?? (snap['trophyEarnedCount'] as number) ?? 0,
      sessionRunCount: (snap.sessionRunCount as number) ?? (snap['sessionRunCount'] as number) ?? 0,
      ...snap
    };
    case 'M66': return {
      newPlayerId: String(snap.newPlayerId ?? snap['newPlayerId'] ?? ''),
      mentorId: String(snap.mentorId ?? snap['mentorId'] ?? ''),
      ...snap
    };
    case 'M67': return {
      runCount: (snap.runCount as number) ?? (snap['runCount'] as number) ?? 0,
      uiUnlockThresholds: snap.uiUnlockThresholds ?? snap['uiUnlockThresholds'],
      ...snap
    };
    case 'M68': return {
      wipedRunId: String(snap.wipedRunId ?? snap['wipedRunId'] ?? ''),
      failureSnapshot: snap.failureSnapshot ?? snap['failureSnapshot'],
      ...snap
    };
    case 'M69': return {
      drillScenario: snap.drillScenario ?? snap['drillScenario'],
      playerAction: String(snap.playerAction ?? snap['playerAction'] ?? ''),
      ...snap
    };
    case 'M70': return {
      teamIds: snap.teamIds ?? snap['teamIds'],
      bootcampConfig: snap.bootcampConfig ?? snap['bootcampConfig'],
      runSeed: String(snap.runSeed ?? snap['RunSeed'] ?? ''),
      ...snap
    };
    case 'M71': return {
      deviceFingerprint: String(snap.deviceFingerprint ?? snap['deviceFingerprint'] ?? ''),
      attestationChallenge: String(snap.attestationChallenge ?? snap['attestationChallenge'] ?? ''),
      trustTierTable: snap.trustTierTable ?? snap['trustTierTable'],
      ...snap
    };
    case 'M72': return {
      playerAction: String(snap.playerAction ?? snap['playerAction'] ?? ''),
      actionTimeline: snap.actionTimeline ?? snap['actionTimeline'],
      actionBudgetConfig: snap.actionBudgetConfig ?? snap['actionBudgetConfig'],
      ...snap
    };
    case 'M73': return {
      marketTransaction: snap.marketTransaction ?? snap['marketTransaction'],
      escrowId: String(snap.escrowId ?? snap['escrowId'] ?? ''),
      settlementConfig: snap.settlementConfig ?? snap['settlementConfig'],
      ...snap
    };
    case 'M74': return {
      runId: String(snap.runId ?? snap['runId'] ?? ''),
      ledgerEntries: snap.ledgerEntries ?? snap['ledgerEntries'],
      redactionRules: snap.redactionRules ?? snap['redactionRules'],
      ...snap
    };
    case 'M75': return {
      seasonId: String(snap.seasonId ?? snap['seasonId'] ?? ''),
      runLedgers: snap.runLedgers ?? snap['runLedgers'],
      digestConfig: snap.digestConfig ?? snap['digestConfig'],
      ...snap
    };
    case 'M76': return {
      contractId: String(snap.contractId ?? snap['contractId'] ?? ''),
      voteConfig: snap.voteConfig ?? snap['voteConfig'],
      participantIds: snap.participantIds ?? snap['participantIds'],
      ...snap
    };
    case 'M77': return {
      delegateId: String(snap.delegateId ?? snap['delegateId'] ?? ''),
      delegationScope: String(snap.delegationScope ?? snap['delegationScope'] ?? ''),
      delegationDuration: (snap.delegationDuration as number) ?? (snap['delegationDuration'] as number) ?? 0,
      ...snap
    };
    case 'M78': return {
      contractId: String(snap.contractId ?? snap['contractId'] ?? ''),
      collateralRequirement: snap.collateralRequirement ?? snap['collateralRequirement'],
      stateTreasury: (snap.treasury as number) ?? 0,
      ...snap
    };
    case 'M79': return {
      bondObjective: snap.bondObjective ?? snap['bondObjective'],
      participantIds: snap.participantIds ?? snap['participantIds'],
      bondAmount: (snap.bondAmount as number) ?? (snap['bondAmount'] as number) ?? 0,
      ...snap
    };
    case 'M80': return {
      contractId: String(snap.contractId ?? snap['contractId'] ?? ''),
      contractOutcome: snap.contractOutcome ?? snap['contractOutcome'],
      proofHash: String(snap.proofHash ?? snap['proofHash'] ?? ''),
      ...snap
    };
    case 'M81': return {
      stateAssets: (snap.assets as Asset[]) ?? [],
      synergyTreeDef: snap.synergyTreeDef ?? snap['synergyTreeDef'],
      playerDoctrineChoice: snap.playerDoctrineChoice ?? snap['playerDoctrineChoice'],
      ...snap
    };
    case 'M82': return {
      stateTick: (snap.tick as number) ?? 0,
      cardSequence: snap.cardSequence ?? snap['cardSequence'],
      timingWindowDef: snap.timingWindowDef ?? snap['timingWindowDef'],
      ...snap
    };
    case 'M83': return {
      stateExposureHeat: (snap.exposureHeat as number) ?? 0,
      riskParityTarget: snap.riskParityTarget ?? snap['riskParityTarget'],
      stateAssets: (snap.assets as Asset[]) ?? [],
      ...snap
    };
    case 'M84': return {
      catalystCard: snap.catalystCard ?? snap['catalystCard'],
      activeSynergySets: Boolean(snap.activeSynergySets ?? snap['activeSynergySets']),
      degeneracyGuardConfig: snap.degeneracyGuardConfig ?? snap['degeneracyGuardConfig'],
      ...snap
    };
    case 'M85': return {
      mutationOptions: snap.mutationOptions ?? snap['mutationOptions'],
      stateAssets: (snap.assets as Asset[]) ?? [],
      stateTick: (snap.tick as number) ?? 0,
      ...snap
    };
    case 'M86': return {
      momentEvent: snap.momentEvent ?? snap['momentEvent'],
      microProofDefs: snap.microProofDefs ?? snap['microProofDefs'],
      ...snap
    };
    case 'M87': return {
      seasonId: String(snap.seasonId ?? snap['seasonId'] ?? ''),
      verifiedFeat: snap.verifiedFeat ?? snap['verifiedFeat'],
      mintGovernorConfig: snap.mintGovernorConfig ?? snap['mintGovernorConfig'],
      ...snap
    };
    case 'M88': return {
      teamId: String(snap.teamId ?? snap['teamId'] ?? ''),
      titleDefinition: snap.titleDefinition ?? snap['titleDefinition'],
      sharedRootHash: String(snap.sharedRootHash ?? snap['sharedRootHash'] ?? ''),
      ...snap
    };
    case 'M89': return {
      trustScore: (snap.trustScore as number) ?? (snap['trustScore'] as number) ?? 0,
      cosmeticBase: snap.cosmeticBase ?? snap['cosmeticBase'],
      integrityMultiplierTable: snap.integrityMultiplierTable ?? snap['integrityMultiplierTable'],
      ...snap
    };
    case 'M90': return {
      achievementId: String(snap.achievementId ?? snap['achievementId'] ?? ''),
      salvageValue: (snap.salvageValue as number) ?? (snap['salvageValue'] as number) ?? 0,
      rerollPool: snap.rerollPool ?? snap['rerollPool'],
      ...snap
    };
    case 'M91': return {
      inviterId: String(snap.inviterId ?? snap['inviterId'] ?? ''),
      newPlayerId: String(snap.newPlayerId ?? snap['newPlayerId'] ?? ''),
      safeRunConfig: snap.safeRunConfig ?? snap['safeRunConfig'],
      ...snap
    };
    case 'M92': return {
      mentorRunId: String(snap.mentorRunId ?? snap['mentorRunId'] ?? ''),
      ghostPayload: snap.ghostPayload ?? snap['ghostPayload'],
      watcherPlayerId: String(snap.watcherPlayerId ?? snap['watcherPlayerId'] ?? ''),
      ...snap
    };
    case 'M93': return {
      presetConfig: snap.presetConfig ?? snap['presetConfig'],
      advantageOptions: snap.advantageOptions ?? snap['advantageOptions'],
      handicapOptions: snap.handicapOptions ?? snap['handicapOptions'],
      ...snap
    };
    case 'M94': return {
      termEncountered: snap.termEncountered ?? snap['termEncountered'],
      playerOptIn: Boolean(snap.playerOptIn ?? snap['playerOptIn']),
      glossaryLibrary: snap.glossaryLibrary ?? snap['glossaryLibrary'],
      ...snap
    };
    case 'M95': return {
      wipedRunId: String(snap.wipedRunId ?? snap['wipedRunId'] ?? ''),
      failureSnapshot: snap.failureSnapshot ?? snap['failureSnapshot'],
      clinicConfig: snap.clinicConfig ?? snap['clinicConfig'],
      ...snap
    };
    case 'M96': return {
      clientTimestamp: (snap.clientTimestamp as number) ?? (snap['clientTimestamp'] as number) ?? 0,
      serverTimestamp: (snap.serverTimestamp as number) ?? (snap['serverTimestamp'] as number) ?? 0,
      toleranceWindow: snap.toleranceWindow ?? snap['toleranceWindow'],
      ...snap
    };
    case 'M97': return {
      playerCommitHash: String(snap.playerCommitHash ?? snap['playerCommitHash'] ?? ''),
      serverRevealHash: String(snap.serverRevealHash ?? snap['serverRevealHash'] ?? ''),
      runId: String(snap.runId ?? snap['runId'] ?? ''),
      ...snap
    };
    case 'M98': return {
      suspiciousRunId: String(snap.suspiciousRunId ?? snap['suspiciousRunId'] ?? ''),
      quarantineFlags: snap.quarantineFlags ?? snap['quarantineFlags'],
      routingConfig: snap.routingConfig ?? snap['routingConfig'],
      ...snap
    };
    case 'M99': return {
      runId: String(snap.runId ?? snap['runId'] ?? ''),
      challengePrompt: String(snap.challengePrompt ?? snap['challengePrompt'] ?? ''),
      expectedResponse: snap.expectedResponse ?? snap['expectedResponse'],
      ...snap
    };
    case 'M100': return {
      appealId: String(snap.appealId ?? snap['appealId'] ?? ''),
      evidenceChain: snap.evidenceChain ?? snap['evidenceChain'],
      enforcementRule: snap.enforcementRule ?? snap['enforcementRule'],
      ...snap
    };
    case 'M101': return {
      mutatorOptions: snap.mutatorOptions ?? snap['mutatorOptions'],
      playerChoice: snap.playerChoice ?? snap['playerChoice'],
      rulesVersion: String(snap.rulesVersion ?? snap['rulesVersion'] ?? ''),
      ...snap
    };
    case 'M102': return {
      forkDecision: snap.forkDecision ?? snap['forkDecision'],
      branchAState: snap.branchAState ?? snap['branchAState'],
      branchBState: snap.branchBState ?? snap['branchBState'],
      ...snap
    };
    case 'M103': return {
      emergencyTrigger: snap.emergencyTrigger ?? snap['emergencyTrigger'],
      stateAssets: (snap.assets as Asset[]) ?? [],
      liquidationDiscount: (snap.liquidationDiscount as number) ?? (snap['liquidationDiscount'] as number) ?? 0,
      ...snap
    };
    case 'M104': return {
      sharedOpportunityDeck: snap.sharedOpportunityDeck ?? snap['sharedOpportunityDeck'],
      purchaseHistory: snap.purchaseHistory ?? snap['purchaseHistory'],
      scarcityThresholds: snap.scarcityThresholds ?? snap['scarcityThresholds'],
      ...snap
    };
    case 'M105': return {
      lastLookTrigger: snap.lastLookTrigger ?? snap['lastLookTrigger'],
      stateTick: (snap.tick as number) ?? 0,
      windowDuration: (snap.windowDuration as number) ?? (snap['windowDuration'] as number) ?? 0,
      ...snap
    };
    case 'M106': return {
      assetId: String(snap.assetId ?? snap['assetId'] ?? ''),
      conditionState: snap.conditionState ?? snap['conditionState'],
      maintenanceCost: (snap.maintenanceCost as number) ?? (snap['maintenanceCost'] as number) ?? 0,
      ...snap
    };
    case 'M107': return {
      liabilityId: String(snap.liabilityId ?? snap['liabilityId'] ?? ''),
      refiTerms: (snap.refiTerms as number) ?? (snap['refiTerms'] as number) ?? 0,
      stateCashflow: (snap.cashflow as number) ?? 0,
      ...snap
    };
    case 'M108': return {
      dealRequest: snap.dealRequest ?? snap['dealRequest'],
      availableCapacity: snap.availableCapacity ?? snap['availableCapacity'],
      fillRules: snap.fillRules ?? snap['fillRules'],
      ...snap
    };
    case 'M109': return {
      macroEvent: snap.macroEvent ?? snap['macroEvent'],
      stateMacroRegime: snap.macroRegime,
      newsBurstConfig: snap.newsBurstConfig ?? snap['newsBurstConfig'],
      ...snap
    };
    case 'M110': return {
      uiAction: snap.uiAction ?? snap['uiAction'],
      stateTick: (snap.tick as number) ?? 0,
      pauseAttempt: snap.pauseAttempt ?? snap['pauseAttempt'],
      ...snap
    };
    case 'M111': return {
      macroRuleDefinition: snap.macroRuleDefinition ?? snap['macroRuleDefinition'],
      state: snap.state ?? snap['state'],
      macroCapConfig: snap.macroCapConfig ?? snap['macroCapConfig'],
      ...snap
    };
    case 'M112': return {
      assetId: String(snap.assetId ?? snap['assetId'] ?? ''),
      splitAmount: (snap.splitAmount as number) ?? (snap['splitAmount'] as number) ?? 0,
      sellPercentage: (snap.sellPercentage as number) ?? (snap['sellPercentage'] as number) ?? 0,
      ...snap
    };
    case 'M113': return {
      sacrificeOrder: snap.sacrificeOrder ?? snap['sacrificeOrder'],
      stateAssets: (snap.assets as Asset[]) ?? [],
      incomingDamage: snap.incomingDamage ?? snap['incomingDamage'],
      ...snap
    };
    case 'M114': return {
      decisionTime: (snap.decisionTime as number) ?? (snap['decisionTime'] as number) ?? 0,
      windowDuration: (snap.windowDuration as number) ?? (snap['windowDuration'] as number) ?? 0,
      timingTaxTable: snap.timingTaxTable ?? snap['timingTaxTable'],
      ...snap
    };
    case 'M115': return {
      sourceAssetId: String(snap.sourceAssetId ?? snap['sourceAssetId'] ?? ''),
      targetAssetId: String(snap.targetAssetId ?? snap['targetAssetId'] ?? ''),
      heatAmount: (snap.heatAmount as number) ?? (snap['heatAmount'] as number) ?? 0,
      ...snap
    };
    case 'M116': return {
      teamId: String(snap.teamId ?? snap['teamId'] ?? ''),
      roleAssignment: snap.roleAssignment ?? snap['roleAssignment'],
      roleSynergies: snap.roleSynergies ?? snap['roleSynergies'],
      ...snap
    };
    case 'M117': return {
      runMoments: snap.runMoments ?? snap['runMoments'],
      socialFeedConfig: snap.socialFeedConfig ?? snap['socialFeedConfig'],
      teamId: String(snap.teamId ?? snap['teamId'] ?? ''),
      ...snap
    };
    case 'M118': return {
      sourceClipHash: String(snap.sourceClipHash ?? snap['sourceClipHash'] ?? ''),
      remixPayload: snap.remixPayload ?? snap['remixPayload'],
      verifiedRunId: String(snap.verifiedRunId ?? snap['verifiedRunId'] ?? ''),
      ...snap
    };
    case 'M119': return {
      rivalryHistory: snap.rivalryHistory ?? snap['rivalryHistory'],
      matchResult: snap.matchResult ?? snap['matchResult'],
      rivalryThreshold: (snap.rivalryThreshold as number) ?? (snap['rivalryThreshold'] as number) ?? 0,
      ...snap
    };
    case 'M120': return {
      socialAction: snap.socialAction ?? snap['socialAction'],
      targetPlayerId: String(snap.targetPlayerId ?? snap['targetPlayerId'] ?? ''),
      consentStatus: Boolean(snap.consentStatus ?? snap['consentStatus']),
      ...snap
    };
    case 'M121': return {
      dailySeed: String(snap.dailySeed ?? snap['dailySeed'] ?? ''),
      gauntletConfig: snap.gauntletConfig ?? snap['gauntletConfig'],
      playerEntry: snap.playerEntry ?? snap['playerEntry'],
      ...snap
    };
    case 'M122': return {
      leagueId: String(snap.leagueId ?? snap['leagueId'] ?? ''),
      draftPool: snap.draftPool ?? snap['draftPool'],
      snakeDraftOrder: snap.snakeDraftOrder ?? snap['snakeDraftOrder'],
      ...snap
    };
    case 'M123': return {
      tableId: String(snap.tableId ?? snap['tableId'] ?? ''),
      winnerHistory: snap.winnerHistory ?? snap['winnerHistory'],
      stakeConfig: snap.stakeConfig ?? snap['stakeConfig'],
      ...snap
    };
    case 'M124': return {
      speedrunConfig: snap.speedrunConfig ?? snap['speedrunConfig'],
      runSeed: String(snap.runSeed ?? snap['RunSeed'] ?? ''),
      timerConfig: snap.timerConfig ?? snap['timerConfig'],
      ...snap
    };
    case 'M125': return {
      hardcoreFlag: Boolean(snap.hardcoreFlag ?? snap['hardcoreFlag']),
      runSeed: String(snap.runSeed ?? snap['RunSeed'] ?? ''),
      hardcoreConfig: Boolean(snap.hardcoreConfig ?? snap['hardcoreConfig']),
      ...snap
    };
    case 'M126': return {
      playerInventory: snap.playerInventory ?? snap['playerInventory'],
      loadoutSelection: snap.loadoutSelection ?? snap['loadoutSelection'],
      integrityScore: (snap.integrityScore as number) ?? (snap['integrityScore'] as number) ?? 0,
      ...snap
    };
    case 'M127': return {
      verifiedFragments: snap.verifiedFragments ?? snap['verifiedFragments'],
      craftingRecipe: snap.craftingRecipe ?? snap['craftingRecipe'],
      fragmentHashes: snap.fragmentHashes ?? snap['fragmentHashes'],
      ...snap
    };
    case 'M128': return {
      trophyCurrency: (snap.trophyCurrency as number) ?? (snap['trophyCurrency'] as number) ?? 0,
      sinkConfig: snap.sinkConfig ?? snap['sinkConfig'],
      burnAmount: (snap.burnAmount as number) ?? (snap['burnAmount'] as number) ?? 0,
      ...snap
    };
    case 'M129': return {
      creatorPackSelection: snap.creatorPackSelection ?? snap['creatorPackSelection'],
      momentEvent: snap.momentEvent ?? snap['momentEvent'],
      captionTemplate: snap.captionTemplate ?? snap['captionTemplate'],
      ...snap
    };
    case 'M130': return {
      teamId: String(snap.teamId ?? snap['teamId'] ?? ''),
      vaultContributions: snap.vaultContributions ?? snap['vaultContributions'],
      vaultConfig: snap.vaultConfig ?? snap['vaultConfig'],
      ...snap
    };
    case 'M131': return {
      factionChoice: String(snap.factionChoice ?? snap['factionChoice'] ?? ''),
      seasonId: String(snap.seasonId ?? snap['seasonId'] ?? ''),
      factionBenefits: snap.factionBenefits ?? snap['factionBenefits'],
      ...snap
    };
    case 'M132': return {
      completedRun: snap.completedRun ?? snap['completedRun'],
      m132MLOutput: snap.m132MLOutput ?? snap['m132MLOutput'],
      ledgerEntries: snap.ledgerEntries ?? snap['ledgerEntries'],
      ...snap
    };
    case 'M133': return {
      seasonConfig: snap.seasonConfig ?? snap['seasonConfig'],
      storyBeatSchedule: snap.storyBeatSchedule ?? snap['storyBeatSchedule'],
      stateTick: (snap.tick as number) ?? 0,
      ...snap
    };
    case 'M134': return {
      npcDefinition: snap.npcDefinition ?? snap['npcDefinition'],
      runSeed: String(snap.runSeed ?? snap['RunSeed'] ?? ''),
      stateTick: (snap.tick as number) ?? 0,
      ...snap
    };
    case 'M135': return {
      runHistory: snap.runHistory ?? snap['runHistory'],
      reputationRules: snap.reputationRules ?? snap['reputationRules'],
      proofHashes: snap.proofHashes ?? snap['proofHashes'],
      ...snap
    };
    case 'M136': return {
      activeRuleset: Boolean(snap.activeRuleset ?? snap['activeRuleset']),
      rulesVersion: String(snap.rulesVersion ?? snap['rulesVersion'] ?? ''),
      stateRunId: String(snap.runId ?? ''),
      ...snap
    };
    case 'M137': return {
      activeRunId: String(snap.activeRunId ?? snap['activeRunId'] ?? ''),
      hotfixPayload: snap.hotfixPayload ?? snap['hotfixPayload'],
      runLockStatus: snap.runLockStatus ?? snap['runLockStatus'],
      ...snap
    };
    case 'M138': return {
      serverLoadMetric: (snap.serverLoadMetric as number) ?? (snap['serverLoadMetric'] as number) ?? 0,
      degradedModeConfig: snap.degradedModeConfig ?? snap['degradedModeConfig'],
      activeRuns: Boolean(snap.activeRuns ?? snap['activeRuns']),
      ...snap
    };
    case 'M139': return {
      offlineRunPayload: snap.offlineRunPayload ?? snap['offlineRunPayload'],
      verificationQueue: snap.verificationQueue ?? snap['verificationQueue'],
      syncConfig: snap.syncConfig ?? snap['syncConfig'],
      ...snap
    };
    case 'M140': return {
      exportRequest: snap.exportRequest ?? snap['exportRequest'],
      runId: String(snap.runId ?? snap['runId'] ?? ''),
      redactionRules: snap.redactionRules ?? snap['redactionRules'],
      ...snap
    };
    case 'M141': return {
      asyncVoteConfig: snap.asyncVoteConfig ?? snap['asyncVoteConfig'],
      participantIds: snap.participantIds ?? snap['participantIds'],
      voteWindow: snap.voteWindow ?? snap['voteWindow'],
      ...snap
    };
    case 'M142': return {
      houseRuleConfig: snap.houseRuleConfig ?? snap['houseRuleConfig'],
      constraintValidator: snap.constraintValidator ?? snap['constraintValidator'],
      lobbyId: String(snap.lobbyId ?? snap['lobbyId'] ?? ''),
      ...snap
    };
    case 'M143': return {
      behaviorReport: snap.behaviorReport ?? snap['behaviorReport'],
      penaltyRules: snap.penaltyRules ?? snap['penaltyRules'],
      playerId: String(snap.playerId ?? snap['playerId'] ?? ''),
      ...snap
    };
    case 'M144': return {
      spectatorConfig: snap.spectatorConfig ?? snap['spectatorConfig'],
      runId: String(snap.runId ?? snap['runId'] ?? ''),
      delayMs: (snap.delayMs as number) ?? (snap['delayMs'] as number) ?? 0,
      ...snap
    };
    case 'M145': return {
      tournamentConfig: snap.tournamentConfig ?? snap['tournamentConfig'],
      participantIds: snap.participantIds ?? snap['participantIds'],
      bracketSeed: String(snap.bracketSeed ?? snap['bracketSeed'] ?? ''),
      ...snap
    };
    case 'M146': return {
      auditTrigger: snap.auditTrigger ?? snap['auditTrigger'],
      stateTick: (snap.tick as number) ?? 0,
      documentationRequired: snap.documentationRequired ?? snap['documentationRequired'],
      ...snap
    };
    case 'M147': return {
      litigationTrigger: snap.litigationTrigger ?? snap['litigationTrigger'],
      stateCash: (snap.cash as number) ?? 0,
      runSeed: String(snap.runSeed ?? snap['RunSeed'] ?? ''),
      ...snap
    };
    case 'M148': return {
      marketTransaction: snap.marketTransaction ?? snap['marketTransaction'],
      counterpartyState: snap.counterpartyState ?? snap['counterpartyState'],
      freezeTrigger: snap.freezeTrigger ?? snap['freezeTrigger'],
      ...snap
    };
    case 'M149': return {
      regulatoryTrigger: snap.regulatoryTrigger ?? snap['regulatoryTrigger'],
      complianceWindow: snap.complianceWindow ?? snap['complianceWindow'],
      stateCash: (snap.cash as number) ?? 0,
      ...snap
    };
    case 'M150': return {
      completedRun: snap.completedRun ?? snap['completedRun'],
      cordScore: (snap.cordScore as number) ?? (snap['cordScore'] as number) ?? 0,
      sovereigntyGrade: snap.sovereigntyGrade ?? snap['sovereigntyGrade'],
      ...snap
    };
    default:
      // Unknown mechanic — return full snapshot; hook authors narrow themselves
      return snap;
  }
}
