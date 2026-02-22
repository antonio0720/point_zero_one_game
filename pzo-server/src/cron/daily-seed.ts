import { DailySeed } from './daily-seed.entity';
import { getRepository } from 'typeorm';
import { config } from '../config';
import { LeaderboardCount } from '../leaderboards/leaderboard-count.entity';

const dailySeedRepository = getRepository(DailySeed);

export async function rotateDailySeed(): Promise<void> {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const midnightUTC = Math.floor(currentTimestamp / 86400) * 86400;
  if (currentTimestamp < midnightUTC) {
    return;
  }

  await dailySeedRepository.save({
    seed: crypto.randomUUID(),
    date: new Date(midnightUTC * 1000),
    leaderboardCount: await getLeaderboardCount(),
  });
}

export async function getDailySeed(): Promise<{ seed: string; date: Date; leaderboard_count: number }> {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const midnightUTC = Math.floor(currentTimestamp / 86400) * 86400;
  if (currentTimestamp < midnightUTC) {
    return await getDailySeed();
  }

  const dailySeed = await dailySeedRepository.findOne({
    where: { date: new Date(midnightUTC * 1000) },
  });
  if (!dailySeed) {
    throw new Error('No daily seed found');
  }

  return {
    seed: dailySeed.seed,
    date: dailySeed.date,
    leaderboard_count: await getLeaderboardCount(),
  };
}

async function getLeaderboardCount(): Promise<number> {
  const leaderboardCount = await LeaderboardCount.findOne({
    where: { id: 1 },
  });
  if (!leaderboardCount) {
    throw new Error('No leaderboard count found');
  }

  return leaderboardCount.count;
}
