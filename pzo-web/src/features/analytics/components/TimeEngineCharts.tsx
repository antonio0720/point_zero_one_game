-- analytics/sql/time_engine_metrics.sql
-- Tier distribution by scenario
SELECT 
  scenario_id,
  COUNT(*) AS total_runs,
  SUM(CASE WHEN tier = 1 THEN 1 ELSE 0 END) AS tier_1,
  SUM(CASE WHEN tier = 2 THEN 1 ELSE 0 END) AS tier_2,
  SUM(CASE WHEN tier = 3 THEN 1 ELSE 0 END) AS tier_3,
  SUM(CASE WHEN tier = 4 THEN 1 ELSE 0 END) AS tier_4,
  SUM(CASE WHEN tier = 5 THEN 1 ELSE 0 END) AS tier_5
FROM time_engine_runs
GROUP BY scenario_id
ORDER BY scenario_id;

-- Timeout rate calculation
SELECT 
  scenario_id,
  COUNT(*) AS total_runs,
  SUM(CASE WHEN timeout THEN 1 ELSE 0 END) AS timeout_count,
  ROUND(
    (SUM(CASE WHEN timeout THEN 1 ELSE 0 END) * 100.0 / COUNT(*)),
    2
  ) AS timeout_rate_percent
FROM time_engine_runs
GROUP BY scenario_id
ORDER BY scenario_id;

-- Decision auto-resolve heatmap
SELECT 
  scenario_id,
  decision_type,
  COUNT(*) AS resolution_count,
  AVG(resolution_time) AS avg_resolution_time
FROM time_engine_decisions
WHERE auto_resolve = true
GROUP BY scenario_id, decision_type
ORDER BY scenario_id, decision_type;
