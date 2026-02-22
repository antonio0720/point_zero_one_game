const user: User = {
id: 1,
username: 'JohnDoe',
points: 0
};

// Award an achievement
awardAchievement(user, {id: 1, name: 'FirstLogin', pointsReward: 50});
console.log(`${user.username}'s points are now ${user.points}`);

// Complete a quest
completeQuest(user, {id: 1, name: 'Kill10Enemies', description: 'Kill 10 enemies in a single game.', requiredPoints: 5});
console.log(`${user.username}'s points are now ${user.points}`);

// Unlock Battle Pass Tier
const battlePass: BattlePass = {
id: 1,
name: 'BattlePass2023',
tiers: [
{tier: 50, reward: 'Skin'},
// Add more tiers here...
]
};
unlockBattlePassTier(user, battlePass);
console.log(`${user.username}'s points are now ${user.points}`);
