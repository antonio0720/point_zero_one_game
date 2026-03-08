//backend/host-os/db/host-stats.ts

import type { QueryResultRow } from 'pg';
import { query } from './connection';

export interface HostDashboardStats {
  totalRegistrations: number;
  totalDownloads: number;
  downloadsToday: number;
  activeSubscribers: number;
  topEmailDomains: Array<{
    domain: string;
    total: number;
  }>;
  topKitVersions: Array<{
    kitVersion: string;
    total: number;
  }>;
}

interface SummaryRow extends QueryResultRow {
  total_registrations: number;
  total_downloads: number;
  downloads_today: number;
  active_subscribers: number;
}

interface DomainRow extends QueryResultRow {
  domain: string;
  total: number;
}

interface KitRow extends QueryResultRow {
  kit_version: string;
  total: number;
}

export async function getHostDashboardStats(): Promise<HostDashboardStats> {
  const [summaryResult, domainsResult, kitsResult] = await Promise.all([
    query<SummaryRow>(`
      SELECT
        COUNT(*)::int AS total_registrations,
        COALESCE(SUM(download_count), 0)::int AS total_downloads,
        COALESCE(
          SUM(
            CASE
              WHEN last_downloaded_at::date = CURRENT_DATE THEN 1
              ELSE 0
            END
          ),
          0
        )::int AS downloads_today,
        COALESCE(
          SUM(
            CASE
              WHEN unsubscribed_at IS NULL THEN 1
              ELSE 0
            END
          ),
          0
        )::int AS active_subscribers
      FROM host_registrations
    `),
    query<DomainRow>(
      `
        SELECT
          split_part(lower(email), '@', 2) AS domain,
          COUNT(*)::int AS total
        FROM host_registrations
        WHERE position('@' in email) > 0
        GROUP BY split_part(lower(email), '@', 2)
        ORDER BY total DESC, domain ASC
        LIMIT 10
      `,
    ),
    query<KitRow>(
      `
        SELECT
          COALESCE(NULLIF(kit_version, ''), 'unknown') AS kit_version,
          COUNT(*)::int AS total
        FROM host_registrations
        GROUP BY COALESCE(NULLIF(kit_version, ''), 'unknown')
        ORDER BY total DESC, kit_version ASC
        LIMIT 10
      `,
    ),
  ]);

  const summary = summaryResult.rows[0] ?? {
    total_registrations: 0,
    total_downloads: 0,
    downloads_today: 0,
    active_subscribers: 0,
  };

  return {
    totalRegistrations: summary.total_registrations,
    totalDownloads: summary.total_downloads,
    downloadsToday: summary.downloads_today,
    activeSubscribers: summary.active_subscribers,
    topEmailDomains: domainsResult.rows.map((row) => ({
      domain: row.domain,
      total: row.total,
    })),
    topKitVersions: kitsResult.rows.map((row) => ({
      kitVersion: row.kit_version,
      total: row.total,
    })),
  };
}