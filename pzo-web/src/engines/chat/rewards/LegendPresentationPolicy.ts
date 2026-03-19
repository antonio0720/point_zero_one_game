/**
 * ==========================================================================
 * POINT ZERO ONE — FRONTEND LEGEND PRESENTATION POLICY
 * FILE: pzo-web/src/engines/chat/rewards/LegendPresentationPolicy.ts
 * ==========================================================================
 *
 * Purpose
 * -------
 * Convert shared legend / reward contracts into deterministic UI-facing models
 * for the chat shell, moment-flash lane, proof-card surfaces, prestige badges,
 * and post-run celebration read models.
 *
 * This file is the render-policy bridge between:
 * - /shared/contracts/chat/ChatLegend.ts
 * - /shared/contracts/chat/ChatReward.ts
 * - /pzo-web/src/components/chat/uiTypes.ts
 * - /pzo-web/src/engines/chat/ChatSelectors.ts
 *
 * Doctrine
 * --------
 * - Render shells stay thin.
 * - Shared contracts remain the prestige truth surface.
 * - Presentation policy chooses tone, accent, emphasis, copy trimming,
 *   attachment shaping, badge density, and surface-specific affordances.
 * - This file owns how a legend feels in the UI without mutating the legend.
 * - Reward presentation should be celebratory without collapsing into noise.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ==========================================================================
 */

import type {
  ChatLegendArtifact,
  ChatLegendClass,
  ChatLegendEvent,
  ChatLegendPresentationSurface,
  ChatLegendSeverity,
  ChatLegendTier,
} from '../../../../../shared/contracts/chat/ChatLegend';
import type {
  ChatRewardCatalogItem,
  ChatRewardClass,
  ChatRewardGrant,
  ChatRewardSurface,
} from '../../../../../shared/contracts/chat/ChatReward';
import type {
  ChatMessage,
  ChatMountTarget,
  ChatVisibleChannel,
  UnixMs,
} from '../types';
import type {
  ChatUiAccent,
  ChatUiAttachment,
  ChatUiAuthorModel,
  ChatUiBadge,
  ChatUiChip,
  ChatUiDisplayIntent,
  ChatUiEmphasis,
  ChatUiMessageCardViewModel,
  ChatUiTextBlock,
  ChatUiTone,
} from '../../../components/chat/uiTypes';

// ============================================================================
// MARK: Presentation contracts
// ============================================================================

export interface LegendMomentFlashViewModel {
  readonly id: string;
  readonly legendId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly tone: ChatUiTone;
  readonly accent: ChatUiAccent;
  readonly emphasis: ChatUiEmphasis;
  readonly durationMs: number;
  readonly badgeText: string;
  readonly rewardPreviewText?: string;
}

export interface LegendProofCardViewModel {
  readonly id: string;
  readonly legendId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly summary: string;
  readonly tierLabel: string;
  readonly severityLabel: string;
  readonly proofLabel: string;
  readonly witnessLabel: string;
  readonly replayLabel?: string;
  readonly tone: ChatUiTone;
  readonly accent: ChatUiAccent;
  readonly rewardLabel?: string;
}

export interface LegendRewardNoticeViewModel {
  readonly id: string;
  readonly label: string;
  readonly subtitle?: string;
  readonly tone: ChatUiTone;
  readonly accent: ChatUiAccent;
  readonly actionable: boolean;
}

export interface LegendBannerViewModel {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly tone: ChatUiTone;
  readonly accent: ChatUiAccent;
  readonly emphasis: ChatUiEmphasis;
  readonly channelId?: ChatVisibleChannel;
}

export interface LegendLockerTileViewModel {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly rarityLabel: string;
  readonly tone: ChatUiTone;
  readonly accent: ChatUiAccent;
  readonly iconKey?: string;
}

export interface LegendPostRunRowViewModel {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly chips: readonly ChatUiChip[];
  readonly badges: readonly ChatUiBadge[];
  readonly tone: ChatUiTone;
  readonly accent: ChatUiAccent;
}

export interface LegendAuthorSignatureViewModel {
  readonly author: ChatUiAuthorModel;
  readonly badges: readonly ChatUiBadge[];
}

export interface LegendSurfaceBundle {
  readonly flash: LegendMomentFlashViewModel;
  readonly proofCard: LegendProofCardViewModel;
  readonly banner: LegendBannerViewModel;
  readonly postRunRow: LegendPostRunRowViewModel;
}

export interface LegendMountSurfaceAvailability {
  readonly mountTarget: ChatMountTarget;
  readonly allowed: readonly ChatLegendPresentationSurface[];
}

export interface LegendRewardDeckViewModel {
  readonly id: string;
  readonly title: string;
  readonly attachments: readonly ChatUiAttachment[];
  readonly badges: readonly ChatUiBadge[];
  readonly tone: ChatUiTone;
  readonly accent: ChatUiAccent;
}

export interface LegendNarrativeCaptionViewModel {
  readonly titleBlock: ChatUiTextBlock;
  readonly summaryBlock: ChatUiTextBlock;
  readonly footerBlock: ChatUiTextBlock;
}

export interface LegendMessagePresentation {
  readonly badges: readonly ChatUiBadge[];
  readonly chips: readonly ChatUiChip[];
  readonly attachments: readonly ChatUiAttachment[];
  readonly tone: ChatUiTone;
  readonly accent: ChatUiAccent;
  readonly displayIntent: ChatUiDisplayIntent;
  readonly emphasis: ChatUiEmphasis;
}

export interface LegendPresentationPolicyConfig {
  readonly momentFlashDurationMs: number;
  readonly maxAttachmentsPerMessage: number;
  readonly maxBadgesPerMessage: number;
  readonly maxChipsPerMessage: number;
  readonly rewardNoticeSurfaceOrder: readonly ChatRewardSurface[];
  readonly debug: boolean;
}

const DEFAULT_LEGEND_PRESENTATION_POLICY_CONFIG: LegendPresentationPolicyConfig = Object.freeze({
  momentFlashDurationMs: 4200,
  maxAttachmentsPerMessage: 4,
  maxBadgesPerMessage: 5,
  maxChipsPerMessage: 4,
  rewardNoticeSurfaceOrder: Object.freeze([
    'MOMENT_FLASH',
    'PROOF_CARD_V2',
    'PROOF_CARD',
    'CHAT_PANEL',
    'NOTIFICATION_TOAST',
    'POST_RUN',
    'LOCKER',
    'PROFILE',
    'BATTLE_HUD',
    'LEAGUE_UI',
  ]),
  debug: false,
});

function tierLabel(tier: ChatLegendTier): string {
  return tier
    .toLowerCase()
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function severityLabel(severity: ChatLegendSeverity): string {
  return severity
    .toLowerCase()
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function toneForLegendClass(className: ChatLegendClass): ChatUiTone {
  switch (className) {
    case 'SOVEREIGNTY_UNDER_PRESSURE':
      return 'celebratory';
    case 'PERFECT_COUNTERPLAY':
      return 'dramatic';
    case 'HUMILIATING_HATER_REVERSAL':
      return 'hostile';
    case 'MIRACLE_RESCUE':
      return 'supportive';
    case 'LAST_SECOND_COMEBACK':
      return 'celebratory';
    case 'NEGOTIATION_HEIST':
      return 'dramatic';
    case 'WITNESS_CASCADE':
      return 'dramatic';
    case 'CROWD_CONVERSION':
      return 'positive';
    case 'BOSS_FIGHT_CONTAINMENT':
      return 'warning';
    case 'SHADOW_REVEAL_PERFECTION':
      return 'stealth';
    default:
      return 'premium';
  }
}

function accentForLegendClass(className: ChatLegendClass): ChatUiAccent {
  switch (className) {
    case 'SOVEREIGNTY_UNDER_PRESSURE':
      return 'gold';
    case 'PERFECT_COUNTERPLAY':
      return 'cyan';
    case 'HUMILIATING_HATER_REVERSAL':
      return 'rose';
    case 'MIRACLE_RESCUE':
      return 'emerald';
    case 'LAST_SECOND_COMEBACK':
      return 'amber';
    case 'NEGOTIATION_HEIST':
      return 'violet';
    case 'WITNESS_CASCADE':
      return 'silver';
    case 'CROWD_CONVERSION':
      return 'emerald';
    case 'BOSS_FIGHT_CONTAINMENT':
      return 'red';
    case 'SHADOW_REVEAL_PERFECTION':
      return 'obsidian';
    default:
      return 'gold';
  }
}

function emphasisForLegendTier(tier: ChatLegendTier): ChatUiEmphasis {
  switch (tier) {
    case 'IMMORTAL':
      return 'hero';
    case 'MYTHIC':
      return 'strong';
    case 'ASCENDANT':
      return 'standard';
    case 'ECHO':
    default:
      return 'subtle';
  }
}

function displayIntentForLegendClass(className: ChatLegendClass): ChatUiDisplayIntent {
  switch (className) {
    case 'PERFECT_COUNTERPLAY':
    case 'BOSS_FIGHT_CONTAINMENT':
      return 'threat';
    case 'MIRACLE_RESCUE':
      return 'helper';
    case 'NEGOTIATION_HEIST':
      return 'deal';
    case 'WITNESS_CASCADE':
    case 'CROWD_CONVERSION':
      return 'spectator';
    case 'SOVEREIGNTY_UNDER_PRESSURE':
    case 'LAST_SECOND_COMEBACK':
      return 'celebration';
    case 'SHADOW_REVEAL_PERFECTION':
      return 'system';
    default:
      return 'default';
  }
}

function badge(id: string, kind: ChatUiBadge['kind'], label: string, tone: ChatUiTone, accent: ChatUiAccent, icon?: string): ChatUiBadge {
  return Object.freeze({
    id,
    kind,
    label,
    shortLabel: label,
    icon,
    tone,
    accent,
  });
}

function chip(id: string, label: string, tone: ChatUiTone, accent: ChatUiAccent): ChatUiChip {
  return Object.freeze({
    id,
    label,
    tone,
    accent,
  });
}

function attachment(
  id: string,
  kind: ChatUiAttachment['kind'],
  label: string,
  subtitle: string | undefined,
  description: string | undefined,
  tone: ChatUiTone,
  accent: ChatUiAccent,
  actionable: boolean,
): ChatUiAttachment {
  return Object.freeze({
    id,
    kind,
    label,
    subtitle,
    description,
    tone,
    accent,
    actionable,
  });
}

function artifactToAttachment(
  artifact: ChatLegendArtifact,
  tone: ChatUiTone,
  accent: ChatUiAccent,
): ChatUiAttachment {
  return attachment(
    `legend-attachment:${artifact.artifactId}`,
    artifact.type === 'REWARD_BUNDLE' ? 'reward' : artifact.type === 'PROOF_CARD' ? 'proof' : 'legend',
    artifact.label,
    artifact.type.replace(/_/g, ' '),
    artifact.description,
    tone,
    accent,
    true,
  );
}

function rewardToAttachment(
  grant: ChatRewardGrant,
  catalog: ChatRewardCatalogItem,
  tone: ChatUiTone,
  accent: ChatUiAccent,
): ChatUiAttachment {
  return attachment(
    `reward-attachment:${grant.rewardGrantId}`,
    'reward',
    catalog.presentation.label,
    catalog.identity.class.replace(/_/g, ' '),
    catalog.presentation.description,
    tone,
    accent,
    grant.status === 'GRANTED',
  );
}

function rewardSurfaceLabel(catalog: ChatRewardCatalogItem): string {
  return catalog.presentation.surfaces[0] ?? 'CHAT_PANEL';
}

export class LegendPresentationPolicy {
  private readonly config: LegendPresentationPolicyConfig;

  public constructor(config: Partial<LegendPresentationPolicyConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_LEGEND_PRESENTATION_POLICY_CONFIG, ...config });
  }

  public buildMomentFlash(
    legend: ChatLegendEvent,
    rewardCatalog?: readonly ChatRewardCatalogItem[],
  ): LegendMomentFlashViewModel {
    const tone = toneForLegendClass(legend.class);
    const accent = accentForLegendClass(legend.class);
    return Object.freeze({
      id: `moment-flash:${legend.legendId}`,
      legendId: String(legend.legendId),
      title: legend.narrative.archiveLabel,
      subtitle: legend.narrative.summary,
      tone,
      accent,
      emphasis: emphasisForLegendTier(legend.tier),
      durationMs: this.config.momentFlashDurationMs,
      badgeText: `${tierLabel(legend.tier)} · ${severityLabel(legend.severity)}`,
      rewardPreviewText: rewardCatalog?.[0]?.presentation.label,
    });
  }

  public buildProofCard(
    legend: ChatLegendEvent,
    rewardCatalog?: readonly ChatRewardCatalogItem[],
  ): LegendProofCardViewModel {
    const tone = toneForLegendClass(legend.class);
    const accent = accentForLegendClass(legend.class);
    return Object.freeze({
      id: `legend-proof-card:${legend.legendId}`,
      legendId: String(legend.legendId),
      title: legend.narrative.archiveLabel,
      subtitle: legend.narrative.turningPoint,
      summary: legend.narrative.summary,
      tierLabel: tierLabel(legend.tier),
      severityLabel: severityLabel(legend.severity),
      proofLabel: `${legend.proof.level} · ${legend.proof.proofHashes.length} proof refs`,
      witnessLabel: `${legend.witnesses.length} witness${legend.witnesses.length === 1 ? '' : 'es'}`,
      replayLabel: legend.replay?.replayId ? `Replay ${legend.replay.replayId}` : undefined,
      tone,
      accent,
      rewardLabel: rewardCatalog?.[0]?.presentation.label,
    });
  }

  public buildRewardNotice(catalog: ChatRewardCatalogItem, grant: ChatRewardGrant): LegendRewardNoticeViewModel {
    const tone = grant.status === 'WITHHELD' ? 'warning' : toneForLegendClass((catalog.eligibility.legendClass ?? 'WITNESS_CASCADE') as ChatLegendClass);
    const accent = accentForLegendClass((catalog.eligibility.legendClass ?? 'WITNESS_CASCADE') as ChatLegendClass);
    return Object.freeze({
      id: `legend-reward-notice:${grant.rewardGrantId}`,
      label: catalog.presentation.label,
      subtitle: catalog.presentation.description,
      tone,
      accent,
      actionable: grant.status === 'GRANTED',
    });
  }

  public buildMessagePresentation(
    legend: ChatLegendEvent,
    rewardCatalog: readonly ChatRewardCatalogItem[] = [],
    rewardGrants: readonly ChatRewardGrant[] = [],
  ): LegendMessagePresentation {
    const tone = toneForLegendClass(legend.class);
    const accent = accentForLegendClass(legend.class);
    const badges: ChatUiBadge[] = [];
    const chips: ChatUiChip[] = [];
    const attachments: ChatUiAttachment[] = [];

    badges.push(badge(`legend-badge:${legend.legendId}`, 'legend', tierLabel(legend.tier), tone, accent, 'legend'));
    badges.push(badge(`reward-badge:${legend.legendId}`, 'reward', `${rewardGrants.length} reward${rewardGrants.length === 1 ? '' : 's'}`, tone, accent, 'reward'));
    badges.push(badge(`proof-badge:${legend.legendId}`, 'proof', legend.proof.level, tone, accent, 'proof'));

    chips.push(chip(`legend-chip:${legend.legendId}:score`, `Prestige ${legend.score.finalScore100}`, tone, accent));
    chips.push(chip(`legend-chip:${legend.legendId}:witness`, `${legend.witnesses.length} witness`, tone, accent));
    if (legend.replay?.replayId) {
      chips.push(chip(`legend-chip:${legend.legendId}:replay`, `Replay ready`, tone, accent));
    }

    for (const artifact of legend.artifacts.slice(0, this.config.maxAttachmentsPerMessage)) {
      attachments.push(artifactToAttachment(artifact, tone, accent));
    }

    for (const [index, grant] of rewardGrants.slice(0, Math.max(0, this.config.maxAttachmentsPerMessage - attachments.length)).entries()) {
      const catalog = rewardCatalog.find((item) => item.identity.rewardId === grant.rewardId);
      if (catalog) {
        attachments.push(rewardToAttachment(grant, catalog, tone, accent));
      } else {
        attachments.push(attachment(
          `reward-attachment:${grant.rewardGrantId}:${index}`,
          'reward',
          'Reward staged',
          grant.status,
          'Reward grant exists without frontend catalog hydration.',
          tone,
          accent,
          false,
        ));
      }
    }

    return Object.freeze({
      badges: Object.freeze(badges.slice(0, this.config.maxBadgesPerMessage)),
      chips: Object.freeze(chips.slice(0, this.config.maxChipsPerMessage)),
      attachments: Object.freeze(attachments.slice(0, this.config.maxAttachmentsPerMessage)),
      tone,
      accent,
      displayIntent: displayIntentForLegendClass(legend.class),
      emphasis: emphasisForLegendTier(legend.tier),
    });
  }

  public augmentMessageCard(
    card: ChatUiMessageCardViewModel,
    legend: ChatLegendEvent,
    rewardCatalog: readonly ChatRewardCatalogItem[] = [],
    rewardGrants: readonly ChatRewardGrant[] = [],
  ): ChatUiMessageCardViewModel {
    const presentation = this.buildMessagePresentation(legend, rewardCatalog, rewardGrants);
    return Object.freeze({
      ...card,
      tone: presentation.tone,
      accent: presentation.accent,
      emphasis: presentation.emphasis,
      displayIntent: presentation.displayIntent,
      body: Object.freeze({
        ...card.body,
        attachments: Object.freeze([...(card.body.attachments ?? []), ...presentation.attachments]),
      }),
      meta: Object.freeze({
        ...card.meta,
        badges: Object.freeze([...(card.meta.badges ?? []), ...presentation.badges]),
        chips: Object.freeze([...(card.meta.chips ?? []), ...presentation.chips]),
      }),
    });
  }

  public buildBanner(legend: ChatLegendEvent, channelId?: ChatVisibleChannel): LegendBannerViewModel {
    return Object.freeze({
      id: `legend-banner:${legend.legendId}`,
      title: legend.narrative.archiveLabel,
      subtitle: legend.narrative.summary,
      tone: toneForLegendClass(legend.class),
      accent: accentForLegendClass(legend.class),
      emphasis: emphasisForLegendTier(legend.tier),
      channelId,
    });
  }

  public buildLockerTile(catalog: ChatRewardCatalogItem, grant: ChatRewardGrant): LegendLockerTileViewModel {
    const tone = toneForLegendClass((catalog.eligibility.legendClass ?? 'WITNESS_CASCADE') as ChatLegendClass);
    const accent = accentForLegendClass((catalog.eligibility.legendClass ?? 'WITNESS_CASCADE') as ChatLegendClass);
    return Object.freeze({
      id: `locker-tile:${grant.rewardGrantId}`,
      title: catalog.presentation.label,
      subtitle: catalog.presentation.description,
      rarityLabel: catalog.identity.rarity,
      tone,
      accent,
      iconKey: catalog.presentation.iconKey,
    });
  }

  public buildPostRunRow(
    legend: ChatLegendEvent,
    rewardCatalog: readonly ChatRewardCatalogItem[] = [],
    rewardGrants: readonly ChatRewardGrant[] = [],
  ): LegendPostRunRowViewModel {
    const presentation = this.buildMessagePresentation(legend, rewardCatalog, rewardGrants);
    return Object.freeze({
      id: `post-run-row:${legend.legendId}`,
      title: legend.narrative.archiveLabel,
      summary: legend.narrative.summary,
      chips: presentation.chips,
      badges: presentation.badges,
      tone: presentation.tone,
      accent: presentation.accent,
    });
  }

  public buildAuthorSignature(legend: ChatLegendEvent): LegendAuthorSignatureViewModel {
    const tone = toneForLegendClass(legend.class);
    const accent = accentForLegendClass(legend.class);
    const author: ChatUiAuthorModel = Object.freeze({
      id: `legend-author:${legend.legendId}`,
      displayName: legend.narrative.archiveLabel,
      sourceKind: 'system',
      disposition: 'systemic',
      subtitle: legend.narrative.summary,
      roleLabel: tierLabel(legend.tier),
      factionLabel: severityLabel(legend.severity),
    });
    return Object.freeze({
      author,
      badges: this.buildLegendSummaryBadges(legend),
    });
  }

  public buildSurfaceBundle(
    legend: ChatLegendEvent,
    rewardCatalog: readonly ChatRewardCatalogItem[] = [],
    rewardGrants: readonly ChatRewardGrant[] = [],
    channelId?: ChatVisibleChannel,
  ): LegendSurfaceBundle {
    return Object.freeze({
      flash: this.buildMomentFlash(legend, rewardCatalog),
      proofCard: this.buildProofCard(legend, rewardCatalog),
      banner: this.buildBanner(legend, channelId),
      postRunRow: this.buildPostRunRow(legend, rewardCatalog, rewardGrants),
    });
  }

  public buildTextBlocks(legend: ChatLegendEvent): readonly ChatUiTextBlock[] {
    const primary: ChatUiTextBlock = Object.freeze({
      id: `legend-text:${legend.legendId}:primary`,
      kind: 'body',
      spans: Object.freeze([{ id: `legend-span:${legend.legendId}:primary`, text: legend.narrative.summary }]),
    });
    const secondary: ChatUiTextBlock = Object.freeze({
      id: `legend-text:${legend.legendId}:secondary`,
      kind: 'caption',
      spans: Object.freeze([{ id: `legend-span:${legend.legendId}:secondary`, text: `${tierLabel(legend.tier)} · ${severityLabel(legend.severity)}` }]),
    });
    return Object.freeze([primary, secondary]);
  }

  public buildArtifactAttachments(legend: ChatLegendEvent): readonly ChatUiAttachment[] {
    const tone = toneForLegendClass(legend.class);
    const accent = accentForLegendClass(legend.class);
    return Object.freeze(legend.artifacts.map((artifact) => artifactToAttachment(artifact, tone, accent)));
  }

  public buildRewardAttachments(
    rewardCatalog: readonly ChatRewardCatalogItem[],
    rewardGrants: readonly ChatRewardGrant[],
  ): readonly ChatUiAttachment[] {
    const output: ChatUiAttachment[] = [];
    for (const grant of rewardGrants) {
      const catalog = rewardCatalog.find((item) => item.identity.rewardId === grant.rewardId);
      if (!catalog) continue;
      const tone = toneForLegendClass((catalog.eligibility.legendClass ?? 'WITNESS_CASCADE') as ChatLegendClass);
      const accent = accentForLegendClass((catalog.eligibility.legendClass ?? 'WITNESS_CASCADE') as ChatLegendClass);
      output.push(rewardToAttachment(grant, catalog, tone, accent));
    }
    return Object.freeze(output);
  }

  public buildMountAvailability(legend: ChatLegendEvent): readonly LegendMountSurfaceAvailability[] {
    const allowed = legend.presentation.surfaces;
    return Object.freeze([
      'BATTLE_HUD',
      'CLUB_UI',
      'EMPIRE_GAME_SCREEN',
      'GAME_BOARD',
      'LEAGUE_UI',
      'LOBBY_SCREEN',
      'PHANTOM_GAME_SCREEN',
      'PREDATOR_GAME_SCREEN',
      'SYNDICATE_GAME_SCREEN',
      'POST_RUN_SUMMARY',
    ].map((mountTarget) => Object.freeze({ mountTarget: mountTarget as ChatMountTarget, allowed })));
  }

  public buildRewardDeck(
    legend: ChatLegendEvent,
    rewardCatalog: readonly ChatRewardCatalogItem[] = [],
    rewardGrants: readonly ChatRewardGrant[] = [],
  ): LegendRewardDeckViewModel {
    const tone = toneForLegendClass(legend.class);
    const accent = accentForLegendClass(legend.class);
    const attachments = this.buildRewardAttachments(rewardCatalog, rewardGrants);
    return Object.freeze({
      id: `reward-deck:${legend.legendId}`,
      title: `${legend.narrative.archiveLabel} Rewards`,
      attachments,
      badges: this.buildLegendSummaryBadges(legend),
      tone,
      accent,
    });
  }

  public buildNarrativeCaptions(legend: ChatLegendEvent): LegendNarrativeCaptionViewModel {
    const titleBlock: ChatUiTextBlock = Object.freeze({
      id: `legend-caption:${legend.legendId}:title`,
      kind: 'notice',
      spans: Object.freeze([{ id: `legend-caption-span:${legend.legendId}:title`, text: legend.narrative.archiveLabel, bold: true }]),
    });
    const summaryBlock: ChatUiTextBlock = Object.freeze({
      id: `legend-caption:${legend.legendId}:summary`,
      kind: 'body',
      spans: Object.freeze([{ id: `legend-caption-span:${legend.legendId}:summary`, text: legend.narrative.summary }]),
    });
    const footerBlock: ChatUiTextBlock = Object.freeze({
      id: `legend-caption:${legend.legendId}:footer`,
      kind: 'caption',
      spans: Object.freeze([{ id: `legend-caption-span:${legend.legendId}:footer`, text: `${tierLabel(legend.tier)} · ${severityLabel(legend.severity)} · ${legend.witnesses.length} witness` }]),
    });
    return Object.freeze({ titleBlock, summaryBlock, footerBlock });
  }

  public buildMountSpecificBundle(
    legend: ChatLegendEvent,
    mountTarget: ChatMountTarget,
    rewardCatalog: readonly ChatRewardCatalogItem[] = [],
    rewardGrants: readonly ChatRewardGrant[] = [],
  ): LegendSurfaceBundle {
    const bundle = this.buildSurfaceBundle(legend, rewardCatalog, rewardGrants);
    if (mountTarget === 'POST_RUN_SUMMARY') {
      return Object.freeze({
        ...bundle,
        banner: Object.freeze({ ...bundle.banner, subtitle: `${bundle.banner.subtitle ?? ''} · Post-run ritual` }),
      });
    }
    if (mountTarget === 'BATTLE_HUD') {
      return Object.freeze({
        ...bundle,
        flash: Object.freeze({ ...bundle.flash, durationMs: Math.min(bundle.flash.durationMs, 3200) }),
      });
    }
    return bundle;
  }

  public buildChannelBadge(channelId: ChatVisibleChannel): ChatUiBadge {
    return badge(`legend-channel:${channelId}`, 'channel', channelId.replace(/_/g, ' '), 'dramatic', 'silver', 'channel');
  }

  public buildReplayBadge(legend: ChatLegendEvent): ChatUiBadge | undefined {
    if (!legend.replay?.replayId) return undefined;
    return badge(`legend-replay:${legend.legendId}`, 'legend', 'Replay Ready', 'dramatic', accentForLegendClass(legend.class), 'replay');
  }

  public buildRewardNotices(
    rewardCatalog: readonly ChatRewardCatalogItem[],
    rewardGrants: readonly ChatRewardGrant[],
  ): readonly LegendRewardNoticeViewModel[] {
    const notices: LegendRewardNoticeViewModel[] = [];
    for (const grant of rewardGrants) {
      const catalog = rewardCatalog.find((item) => item.identity.rewardId === grant.rewardId);
      if (!catalog) continue;
      notices.push(this.buildRewardNotice(catalog, grant));
    }
    return Object.freeze(notices);
  }

  public buildLegendSummaryBadges(legend: ChatLegendEvent): readonly ChatUiBadge[] {
    const tone = toneForLegendClass(legend.class);
    const accent = accentForLegendClass(legend.class);
    return Object.freeze([
      badge(`legend-summary:${legend.legendId}:tier`, 'legend', tierLabel(legend.tier), tone, accent),
      badge(`legend-summary:${legend.legendId}:severity`, 'legend', severityLabel(legend.severity), tone, accent),
      badge(`legend-summary:${legend.legendId}:proof`, 'proof', legend.proof.level, tone, accent),
    ]);
  }

  public buildRewardBadges(catalog: ChatRewardCatalogItem, grant: ChatRewardGrant): readonly ChatUiBadge[] {
    const tone = toneForLegendClass((catalog.eligibility.legendClass ?? 'WITNESS_CASCADE') as ChatLegendClass);
    const accent = accentForLegendClass((catalog.eligibility.legendClass ?? 'WITNESS_CASCADE') as ChatLegendClass);
    return Object.freeze([
      badge(`reward-badge:${grant.rewardGrantId}:class`, 'reward', catalog.identity.class.replace(/_/g, ' '), tone, accent),
      badge(`reward-badge:${grant.rewardGrantId}:status`, 'reward', grant.status, tone, accent),
    ]);
  }
}

export function createLegendPresentationPolicy(
  config: Partial<LegendPresentationPolicyConfig> = {},
): LegendPresentationPolicy {
  return new LegendPresentationPolicy(config);
}

export const CHAT_LEGEND_PRESENTATION_POLICY_MODULE_NAME = 'PZO_CHAT_LEGEND_PRESENTATION_POLICY' as const;

export const CHAT_LEGEND_PRESENTATION_POLICY_MANIFEST = Object.freeze({
  moduleName: CHAT_LEGEND_PRESENTATION_POLICY_MODULE_NAME,
  version: '1.0.0',
  path: '/pzo-web/src/engines/chat/rewards/LegendPresentationPolicy.ts',
  authorities: Object.freeze({
    frontendRewardsRoot: '/pzo-web/src/engines/chat/rewards',
    sharedLegendContract: '/shared/contracts/chat/ChatLegend.ts',
    sharedRewardContract: '/shared/contracts/chat/ChatReward.ts',
    componentsUiTypes: '/pzo-web/src/components/chat/uiTypes.ts',
  }),
  owns: Object.freeze([
    'legend tone / accent / emphasis policy',
    'moment flash shaping',
    'proof-card shaping',
    'legend badge / chip / attachment shaping',
    'reward notice shaping',
    'message-card augmentation for legend moments',
  ] as const),
  dependsOn: Object.freeze([
    '../../../../../shared/contracts/chat/ChatLegend',
    '../../../../../shared/contracts/chat/ChatReward',
    '../../../components/chat/uiTypes',
  ] as const),
} as const);

export const LegendPresentationPolicyModule = Object.freeze({
  moduleName: CHAT_LEGEND_PRESENTATION_POLICY_MODULE_NAME,
  manifest: CHAT_LEGEND_PRESENTATION_POLICY_MANIFEST,
  defaults: DEFAULT_LEGEND_PRESENTATION_POLICY_CONFIG,
  createLegendPresentationPolicy,
  LegendPresentationPolicy,
} as const);
