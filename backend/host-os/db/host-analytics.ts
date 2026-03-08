//backend/host-os/db/host-analytics.ts

import type { QueryResultRow } from 'pg';
import { query, queryOneOrNull } from './connection';

export interface HostAnalytics {
  email: string;
  hostHealthScore: number;
  streak: number;
  nightsHosted: number;
  avgMomentsPerNight: number;
  clipsPostedRate: number;
  nextNightBookedRate: number;
  totalMomentsCaptured: number;
  totalClipsPosted: number;
  lastHostedAt: string | null;
}

interface HostAnalyticsSummaryRow extends QueryResultRow {
  email: string;
  nights_hosted: number;
  avg_moments_per_night: number;
  clips_posted_rate: number;
  next_night_booked_rate: number;
  total_moments_captured: number;
  total_clips_posted: number;
  last_hosted_at: string | null;
}

interface HostNightDateRow extends QueryResultRow {
  night_at: string;
}

export async function getHostAnalyticsByEmail(
  rawEmail: string,
): Promise<HostAnalytics | null> {
  const email = normalizeEmail(rawEmail);

  const summary = await queryOneOrNull<HostAnalyticsSummaryRow>(
    `
      SELECT
        LOWER(host_email) AS email,
        COUNT(*)::int AS nights_hosted,
        COALESCE(AVG(moments_captured), 0)::float8 AS avg_moments_per_night,
        COALESCE(
          SUM(CASE WHEN clips_posted > 0 THEN 1 ELSE 0 END)::float8
          / NULLIF(COUNT(*), 0),
          0
        )::float8 AS clips_posted_rate,
        COALESCE(
          SUM(CASE WHEN next_date_booked IS NOT NULL THEN 1 ELSE 0 END)::float8
          / NULLIF(COUNT(*), 0),
          0
        )::float8 AS next_night_booked_rate,
        COALESCE(SUM(moments_captured), 0)::int AS total_moments_captured,
        COALESCE(SUM(clips_posted), 0)::int AS total_clips_posted,
        MAX(night_at)::text AS last_hosted_at
      FROM host_nights
      WHERE LOWER(host_email) = $1
      GROUP BY LOWER(host_email)
    `,
    [email],
  );

  if (!summary) {
    return null;
  }

  const nightDatesResult = await query<HostNightDateRow>(
    `
      SELECT night_at::text AS night_at
      FROM host_nights
      WHERE LOWER(host_email) = $1
      ORDER BY night_at DESC, id DESC
      LIMIT 104
    `,
    [email],
  );

  const sortedNightDates = nightDatesResult.rows
    .map((row) => new Date(row.night_at))
    .filter((value) => Number.isFinite(value.getTime()));

  const streak = computeWeeklyHabitStreak(sortedNightDates);
  const hostHealthScore = computeHostHealthScore({
    nightsHosted: summary.nights_hosted,
    streak,
    avgMomentsPerNight: summary.avg_moments_per_night,
    clipsPostedRate: summary.clips_posted_rate,
    nextNightBookedRate: summary.next_night_booked_rate,
    lastHostedAt: summary.last_hosted_at,
  });

  return {
    email: summary.email,
    hostHealthScore,
    streak,
    nightsHosted: summary.nights_hosted,
    avgMomentsPerNight: round(summary.avg_moments_per_night, 2),
    clipsPostedRate: round(summary.clips_posted_rate, 4),
    nextNightBookedRate: round(summary.next_night_booked_rate, 4),
    totalMomentsCaptured: summary.total_moments_captured,
    totalClipsPosted: summary.total_clips_posted,
    lastHostedAt: summary.last_hosted_at,
  };
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    throw new Error('email must not be empty');
  }

  if (!normalized.includes('@')) {
    throw new Error('email must be a valid email-like value');
  }

  return normalized;
}

function computeWeeklyHabitStreak(sortedNightDates: readonly Date[]): number {
  if (sortedNightDates.length === 0) {
    return 0;
  }

  let streak = 1;

  for (let index = 1; index < sortedNightDates.length; index += 1) {
    const newer = sortedNightDates[index - 1];
    const older = sortedNightDates[index];
    const gapDays = Math.abs(newer.getTime() - older.getTime()) / 86_400_000;

    if (gapDays <= 14) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

function computeHostHealthScore(input: {
  nightsHosted: number;
  streak: number;
  avgMomentsPerNight: number;
  clipsPostedRate: number;
  nextNightBookedRate: number;
  lastHostedAt: string | null;
}): number {
  const activityScore = clamp01(input.nightsHosted / 12);
  const streakScore = clamp01(input.streak / 6);
  const momentsScore = clamp01(input.avgMomentsPerNight / 6);
  const clipsScore = clamp01(input.clipsPostedRate);
  const rebookScore = clamp01(input.nextNightBookedRate);
  const recencyScore = clamp01(calculateRecencyScore(input.lastHostedAt));

  const weighted =
    activityScore * 0.2 +
    streakScore * 0.25 +
    momentsScore * 0.15 +
    clipsScore * 0.15 +
    rebookScore * 0.15 +
    recencyScore * 0.1;

  return round(weighted * 100, 2);
}

function calculateRecencyScore(lastHostedAt: string | null): number {
  if (!lastHostedAt) {
    return 0;
  }

  const parsed = new Date(lastHostedAt);
  if (!Number.isFinite(parsed.getTime())) {
    return 0;
  }

  const ageDays = Math.max(0, (Date.now() - parsed.getTime()) / 86_400_000);
  if (ageDays <= 7) {
    return 1;
  }

  if (ageDays >= 28) {
    return 0;
  }

  return 1 - (ageDays - 7) / 21;
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}