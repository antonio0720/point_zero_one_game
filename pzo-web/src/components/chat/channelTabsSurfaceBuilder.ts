import type {
  ChannelTabHeatViewModel,
  ChannelTabIntegrityViewModel,
  ChannelTabMetaLineViewModel,
  ChannelTabPresenceViewModel,
  ChannelTabSeriousness,
  ChannelTabViewModel,
} from './uiTypes';

export interface ChannelTabRecord {
  unread: number;
  heat?: ChannelTabHeatViewModel;
  presence?: ChannelTabPresenceViewModel | null;
  integrity?: ChannelTabIntegrityViewModel | null;
  metaLines?: ChannelTabMetaLineViewModel[];
  recommended?: boolean;
  recommendationLabel?: string;
  seriousness?: ChannelTabSeriousness;
  disabled?: boolean;
}

export interface BuildChannelTabViewModelsOptions {
  activeChannel: string;
  records: {
    GLOBAL: ChannelTabRecord;
    SYNDICATE: ChannelTabRecord;
    DEAL_ROOM: ChannelTabRecord;
  };
}

const BASE = {
  GLOBAL: {
    label: 'Global',
    shortLabel: 'Global',
    icon: '◎',
    description: 'Theatrical crowd lane. Fast, visible, witness-heavy.',
    hotkeyHint: '1',
    displayOrder: 1,
  },
  SYNDICATE: {
    label: 'Syndicate',
    shortLabel: 'Syndicate',
    icon: '◈',
    description: 'Tactical intimacy, trust, and quiet command.',
    hotkeyHint: '2',
    displayOrder: 2,
  },
  DEAL_ROOM: {
    label: 'Deal Room',
    shortLabel: 'Deal',
    icon: '◇',
    description: 'Predatory negotiation lane. Transcript-sensitive.',
    hotkeyHint: '3',
    displayOrder: 3,
  },
} as const;

function helperCue(record: ChannelTabRecord): string | undefined {
  if (record.presence?.helperVisible) return 'helper visible';
  if (record.recommended) return 'recommended';
  return undefined;
}

function haterCue(record: ChannelTabRecord): string | undefined {
  if (record.presence?.haterVisible) return 'hater visible';
  if ((record.heat?.band ?? 'QUIET') === 'SEVERE') return 'severe heat';
  return undefined;
}

export function buildChannelTabViewModels(options: BuildChannelTabViewModelsOptions): ChannelTabViewModel[] {
  const build = (channelId: keyof typeof BASE, record: ChannelTabRecord): ChannelTabViewModel => ({
    channelId,
    label: BASE[channelId].label,
    shortLabel: BASE[channelId].shortLabel,
    icon: BASE[channelId].icon,
    description: BASE[channelId].description,
    unread: record.unread,
    active: options.activeChannel === channelId,
    disabled: record.disabled,
    recommended: record.recommended,
    recommendationLabel: record.recommendationLabel,
    seriousness: record.seriousness ?? ((record.heat?.band === 'SEVERE' || record.heat?.band === 'HIGH') ? 'high' : 'normal'),
    hotkeyHint: BASE[channelId].hotkeyHint,
    displayOrder: BASE[channelId].displayOrder,
    helperCue: helperCue(record),
    haterCue: haterCue(record),
    heat: record.heat,
    presence: record.presence ?? null,
    integrity: record.integrity ?? null,
    metaLines: record.metaLines,
  });

  return [
    build('GLOBAL', options.records.GLOBAL),
    build('SYNDICATE', options.records.SYNDICATE),
    build('DEAL_ROOM', options.records.DEAL_ROOM),
  ];
}
