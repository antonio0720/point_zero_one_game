-- backend/migrations/0030_balance_analytics.sql

SET SQL_MODE = 'NO_AUTO_CREATE_USER';

-- Create table for balance snapshots
CREATE TABLE IF NOT EXISTS `balance_snapshots` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `profile_id` INT NOT NULL,
  `scenario_id` INT NOT NULL,
  `ruleset_version` INT NOT NULL,
  `win_rate` DECIMAL(10, 4) NOT NULL DEFAULT 0.0,
  `death_causes_json` JSON NOT NULL,
  `computed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`scenario_id`) REFERENCES `scenarios` (`id`) ON DELETE CASCADE,
);

-- Create index for balance snapshots on profile_id and scenario_id
CREATE INDEX IF NOT EXISTS `balance_snapshots_profile_scenario_idx`
  ON `balance_snapshots` (`profile_id`, `scenario_id`);

-- Create table for card impact scores
CREATE TABLE IF NOT EXISTS `card_impact_scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `card_id` INT NOT NULL,
  `win_rate` DECIMAL(10, 4) NOT NULL DEFAULT 0.0,
  `death_causes_json` JSON NOT NULL,
  `computed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (`card_id`) REFERENCES `cards` (`id`) ON DELETE CASCADE,
);

-- Create index for card impact scores on card_id
CREATE INDEX IF NOT EXISTS `card_impact_scores_card_idx`
  ON `card_impact_scores` (`card_id`);

-- Create table for deal strength scores
CREATE TABLE IF NOT EXISTS `deal_strength_scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `deal_id` INT NOT NULL,
  `win_rate` DECIMAL(10, 4) NOT NULL DEFAULT 0.0,
  `death_causes_json` JSON NOT NULL,
  `computed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE CASCADE,
);

-- Create index for deal strength scores on deal_id
CREATE INDEX IF NOT EXISTS `deal_strength_scores_deal_idx`
  ON `deal_strength_scores` (`deal_id`);

-- Create table for daily rollup
CREATE TABLE IF NOT EXISTS `daily_rollup` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` DATE NOT NULL,
  `total_games` INT NOT NULL DEFAULT 0,
  `total_wins` INT NOT NULL DEFAULT 0,
  `total_losses` INT NOT NULL DEFAULT 0,
  `average_win_rate` DECIMAL(10, 4) NOT NULL DEFAULT 0.0,
  `computed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
);

-- Create index for daily rollup on date
CREATE INDEX IF NOT EXISTS `daily_rollup_date_idx`
  ON `daily_rollup` (`date`);
