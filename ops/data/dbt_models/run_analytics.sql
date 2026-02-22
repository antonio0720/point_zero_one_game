Here is the `run_analytics.sql` file in SQL format, adhering to the specified rules:

```sql
-- dbt model: run_analytics (profile_win_rates, turn_survival_rates, card_impact, failure_mode_distribution, session_length_p50/p95)
-- daily refresh; partitioned by date + ruleset_version

WITH
  profile_win_rates AS (
    SELECT
      date,
      ruleset_version,
      SUM(CASE WHEN player_wins THEN 1 ELSE 0 END) / COUNT(*) AS win_rate
    FROM game_sessions
    GROUP BY 1, 2
  ),

  turn_survival_rates AS (
    SELECT
      date,
      ruleset_version,
      SUM(CASE WHEN player_alive = true THEN 1 ELSE 0 END) / COUNT(*) AS survival_rate
    FROM game_sessions
    GROUP BY 1, 2
  ),

  card_impact AS (
    SELECT
      card_id,
      AVG(damage_dealt) AS avg_damage_dealt,
      COUNT(*) AS total_plays
    FROM game_sessions
    GROUP BY 1
  ),

  failure_mode_distribution AS (
    SELECT
      failure_reason,
      COUNT(*) AS count
    FROM game_sessions
    GROUP BY 1
  ),

  session_length AS (
    SELECT
      date,
      ruleset_version,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY session_duration) AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY session_duration) AS p95
    FROM game_sessions
    GROUP BY 1, 2
  )

SELECT
  profile_win_rates.date,
  profile_win_rates.ruleset_version,
  profile_win_rates.win_rate,
  turn_survival_rates.survival_rate,
  jsonb_agg(card_impact) AS card_impact,
  jsonb_agg(failure_mode_distribution) AS failure_mode_distribution,
  session_length.p50 AS session_length_p50,
  session_length.p95 AS session_length_p95
FROM profile_win_rates
JOIN turn_survival_rates ON profile_win_rates.date = turn_survival_rates.date AND profile_win_rates.ruleset_version = turn_survival_rates.ruleset_version
LEFT JOIN card_impact ON true
LEFT JOIN failure_mode_distribution ON true
JOIN session_length ON profile_win_rates.date = session_length.date AND profile_win_rates.ruleset_version = session_length.ruleset_version
GROUP BY 1, 2;
