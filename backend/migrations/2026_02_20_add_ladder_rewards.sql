-- File: backend/migrations/2026_02_20_add_ladder_rewards.sql

CREATE TABLE IF NOT EXISTS ladder_reward_unlocks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    ladder_tier INTEGER NOT NULL CHECK (ladder_tier >= 1 AND ladder_tier <= 100),
    reward_id INTEGER NOT NULL REFERENCES cosmetic_rewards(id),
    UNIQUE (user_id, ladder_tier)
);

-- File: backend/src/migrations/2026_02_20_add_ladder_rewards.ts

/**
 * Adds a table for tracking cosmetic rewards unlocked by users based on their ladder tier.
 */
import { MigrationInterface, QueryBuilder } from 'knex';

export class AddLadderRewardUnlocks implements MigrationInterface {
  public async up(builder: QueryBuilder): Promise<void> {
    await builder.schema.createTable('ladder_reward_unlocks', (table) => {
      table.increments('id').primary();
      table.integer('user_id').notNullable().references('users.id');
      table.integer('ladder_tier').notNullable().checkIn('(1, 100)');
      table.integer('reward_id').notNullable().references('cosmetic_rewards.id');
      table.unique(['user_id', 'ladder_tier']);
    });
  }

  public async down(builder: QueryBuilder): Promise<void> {
    await builder.schema.dropTableIfExists('ladder_reward_unlocks');
  }
}
