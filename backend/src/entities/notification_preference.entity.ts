// backend/src/entities/notification_preference.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Account } from '../accounts/account.entity';

export enum NotificationChannel {
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
}

export interface NotificationQuietWindow {
  startMinute: number;
  endMinute: number;
  daysOfWeek?: number[];
  label?: string;
}

export interface NotificationChannelOverride {
  enabled?: boolean;
  marketingEnabled?: boolean;
  digestEnabled?: boolean;
  quietHoursTimezone?: string | null;
  templateAllowlist?: string[];
  templateDenylist?: string[];
}

export type NotificationChannelOverrideMap = Partial<
  Record<NotificationChannel, NotificationChannelOverride>
>;

function normalizeMinute(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = Math.trunc(value);
  if (normalized < 0) {
    return 0;
  }

  if (normalized > 1439) {
    return 1439;
  }

  return normalized;
}

function normalizeDayOfWeek(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  if (normalized < 0 || normalized > 6) {
    return null;
  }

  return normalized;
}

function normalizeQuietWindow(
  window: NotificationQuietWindow,
): NotificationQuietWindow {
  const normalizedDays =
    Array.isArray(window.daysOfWeek) && window.daysOfWeek.length > 0
      ? [...new Set(window.daysOfWeek.map(normalizeDayOfWeek).filter((day): day is number => day !== null))]
      : undefined;

  return {
    startMinute: normalizeMinute(window.startMinute),
    endMinute: normalizeMinute(window.endMinute),
    daysOfWeek: normalizedDays,
    label:
      typeof window.label === 'string' && window.label.trim().length > 0
        ? window.label.trim().slice(0, 128)
        : undefined,
  };
}

function cloneOverride(
  override: NotificationChannelOverride | undefined,
): NotificationChannelOverride | undefined {
  if (!override) {
    return undefined;
  }

  return {
    enabled:
      typeof override.enabled === 'boolean' ? override.enabled : undefined,
    marketingEnabled:
      typeof override.marketingEnabled === 'boolean'
        ? override.marketingEnabled
        : undefined,
    digestEnabled:
      typeof override.digestEnabled === 'boolean'
        ? override.digestEnabled
        : undefined,
    quietHoursTimezone:
      typeof override.quietHoursTimezone === 'string'
        ? override.quietHoursTimezone.trim().slice(0, 64)
        : override.quietHoursTimezone === null
          ? null
          : undefined,
    templateAllowlist: Array.isArray(override.templateAllowlist)
      ? [...new Set(override.templateAllowlist.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
      : undefined,
    templateDenylist: Array.isArray(override.templateDenylist)
      ? [...new Set(override.templateDenylist.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
      : undefined,
  };
}

@Entity('notification_preferences')
@Index('idx_notification_preferences_account_id', ['accountId'], {
  unique: true,
})
export class NotificationPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @Column({ type: 'boolean', name: 'push_enabled', default: false })
  pushEnabled: boolean;

  @Column({ type: 'boolean', name: 'email_enabled', default: false })
  emailEnabled: boolean;

  @Column({ type: 'boolean', name: 'sms_enabled', default: false })
  smsEnabled: boolean;

  @Column({ type: 'boolean', name: 'marketing_enabled', default: false })
  marketingEnabled: boolean;

  @Column({ type: 'boolean', name: 'digest_enabled', default: false })
  digestEnabled: boolean;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'quiet_hours_timezone',
    nullable: true,
  })
  quietHoursTimezone: string | null;

  @Column({
    type: 'jsonb',
    name: 'do_not_disturb_windows',
    default: () => "'[]'::jsonb",
  })
  doNotDisturbWindows: NotificationQuietWindow[];

  @Column({
    type: 'jsonb',
    name: 'channel_overrides_json',
    default: () => "'{}'::jsonb",
  })
  channelOverridesJson: NotificationChannelOverrideMap;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  normalizeQuietHoursTimezone(): string | null {
    if (typeof this.quietHoursTimezone !== 'string') {
      return null;
    }

    const normalized = this.quietHoursTimezone.trim();
    return normalized.length > 0 ? normalized.slice(0, 64) : null;
  }

  normalizeDoNotDisturbWindows(): NotificationQuietWindow[] {
    if (!Array.isArray(this.doNotDisturbWindows)) {
      return [];
    }

    return this.doNotDisturbWindows.map(normalizeQuietWindow);
  }

  normalizeChannelOverrides(): NotificationChannelOverrideMap {
    const source =
      this.channelOverridesJson &&
      typeof this.channelOverridesJson === 'object' &&
      !Array.isArray(this.channelOverridesJson)
        ? this.channelOverridesJson
        : {};

    return {
      [NotificationChannel.PUSH]: cloneOverride(
        source[NotificationChannel.PUSH],
      ),
      [NotificationChannel.EMAIL]: cloneOverride(
        source[NotificationChannel.EMAIL],
      ),
      [NotificationChannel.SMS]: cloneOverride(source[NotificationChannel.SMS]),
    };
  }

  getBaseChannelState(channel: NotificationChannel): boolean {
    switch (channel) {
      case NotificationChannel.PUSH:
        return this.pushEnabled === true;
      case NotificationChannel.EMAIL:
        return this.emailEnabled === true;
      case NotificationChannel.SMS:
        return this.smsEnabled === true;
      default:
        return false;
    }
  }

  isChannelEnabled(channel: NotificationChannel): boolean {
    const overrides = this.normalizeChannelOverrides();
    const override = overrides[channel];

    if (override && typeof override.enabled === 'boolean') {
      return override.enabled;
    }

    return this.getBaseChannelState(channel);
  }

  setChannelEnabled(channel: NotificationChannel, enabled: boolean): void {
    const nextValue = enabled === true;

    switch (channel) {
      case NotificationChannel.PUSH:
        this.pushEnabled = nextValue;
        break;
      case NotificationChannel.EMAIL:
        this.emailEnabled = nextValue;
        break;
      case NotificationChannel.SMS:
        this.smsEnabled = nextValue;
        break;
      default:
        break;
    }
  }

  allowsMarketing(channel?: NotificationChannel): boolean {
    if (!this.marketingEnabled) {
      return false;
    }

    if (!channel) {
      return true;
    }

    const override = this.getChannelOverride(channel);
    if (override && typeof override.marketingEnabled === 'boolean') {
      return override.marketingEnabled;
    }

    return this.isChannelEnabled(channel);
  }

  allowsDigest(channel?: NotificationChannel): boolean {
    if (!this.digestEnabled) {
      return false;
    }

    if (!channel) {
      return true;
    }

    const override = this.getChannelOverride(channel);
    if (override && typeof override.digestEnabled === 'boolean') {
      return override.digestEnabled;
    }

    return this.isChannelEnabled(channel);
  }

  getChannelOverride(
    channel: NotificationChannel,
  ): NotificationChannelOverride | undefined {
    return this.normalizeChannelOverrides()[channel];
  }

  setChannelOverride(
    channel: NotificationChannel,
    override: NotificationChannelOverride | null,
  ): void {
    const normalized = this.normalizeChannelOverrides();

    if (override === null) {
      delete normalized[channel];
      this.channelOverridesJson = normalized;
      return;
    }

    normalized[channel] = cloneOverride(override) ?? {};
    this.channelOverridesJson = normalized;
  }

  replaceDoNotDisturbWindows(windows: NotificationQuietWindow[]): void {
    this.doNotDisturbWindows = Array.isArray(windows)
      ? windows.map(normalizeQuietWindow)
      : [];
  }

  isWithinDoNotDisturbWindow(
    localMinuteOfDay: number,
    localDayOfWeek?: number,
  ): boolean {
    const minute = normalizeMinute(localMinuteOfDay);
    const day =
      typeof localDayOfWeek === 'number'
        ? normalizeDayOfWeek(localDayOfWeek)
        : null;

    for (const window of this.normalizeDoNotDisturbWindows()) {
      if (
        Array.isArray(window.daysOfWeek) &&
        window.daysOfWeek.length > 0 &&
        day !== null &&
        !window.daysOfWeek.includes(day)
      ) {
        continue;
      }

      if (window.startMinute <= window.endMinute) {
        if (minute >= window.startMinute && minute <= window.endMinute) {
          return true;
        }
        continue;
      }

      if (minute >= window.startMinute || minute <= window.endMinute) {
        return true;
      }
    }

    return false;
  }

  canDeliver(
    channel: NotificationChannel,
    options?: {
      localMinuteOfDay?: number;
      localDayOfWeek?: number;
      marketing?: boolean;
      digest?: boolean;
    },
  ): boolean {
    if (!this.isChannelEnabled(channel)) {
      return false;
    }

    if (options?.marketing === true && !this.allowsMarketing(channel)) {
      return false;
    }

    if (options?.digest === true && !this.allowsDigest(channel)) {
      return false;
    }

    if (
      typeof options?.localMinuteOfDay === 'number' &&
      this.isWithinDoNotDisturbWindow(
        options.localMinuteOfDay,
        options.localDayOfWeek,
      )
    ) {
      return false;
    }

    return true;
  }
}