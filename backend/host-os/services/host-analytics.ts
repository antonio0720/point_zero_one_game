/**
 * HostAnalytics service.
 *
 * Tracks various host metrics and provides a weekly cohort rollup of these metrics.
 * Also calculates a health score for each host, which is a value between 0 and 100.
 */
export class HostAnalytics {
  private dbConnection: any;

  constructor(dbConnection: any) {
    this.dbConnection = dbConnection;
  }

  async getHostMetrics(hostId: number): Promise<any> {
    const query = `
      SELECT 
        kit_downloaded, 
        night_logged, 
        moments_captured, 
        clips_posted, 
        next_night_booked
      FROM 
        host_metrics
      WHERE 
        host_id = $1;
    `;
    const result = await this.dbConnection.query(query, [hostId]);
    return result.rows[0];
  }

  async getWeeklyCohortRollup(): Promise<any> {
    const query = `
      SELECT 
        EXTRACT(WEEK FROM night_logged) AS week,
        COUNT(*) AS count
      FROM 
        host_metrics
      GROUP BY 
        week;
    `;
    const result = await this.dbConnection.query(query);
    return result.rows;
  }

  async getHostHealthScore(hostId: number): Promise<number> {
    const metrics = await this.getHostMetrics(hostId);
    const score = (metrics.kit_downloaded + metrics.night_logged + metrics.moments_captured + metrics.clips_posted) / 4;
    return Math.min(Math.max(score, 0), 100);
  }
}

export function createHostAnalyticsTable(dbConnection: any): void {
  dbConnection.query(`
    CREATE TABLE IF NOT EXISTS host_metrics (
      id SERIAL PRIMARY KEY,
      host_id INTEGER NOT NULL,
      kit_downloaded INTEGER DEFAULT 0,
      night_logged INTEGER DEFAULT 0,
      moments_captured INTEGER DEFAULT 0,
      clips_posted INTEGER DEFAULT 0,
      next_night_booked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  dbConnection.query(`
    CREATE TABLE IF NOT EXISTS host_health_scores (
      id SERIAL PRIMARY KEY,
      host_id INTEGER NOT NULL,
      health_score REAL NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE host_health_scores
      ADD CONSTRAINT fk_host_id FOREIGN KEY (host_id) REFERENCES host_metrics(id);
  `);

  dbConnection.query(`
    CREATE INDEX IF NOT EXISTS idx_host_id ON host_metrics (host_id);
    CREATE INDEX IF NOT EXISTS idx_night_logged ON host_metrics (night_logged);
  `);
}
