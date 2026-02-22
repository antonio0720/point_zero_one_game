const rewards = [
{ id: '1', name: 'Reward 1', description: 'Description for Reward 1' },
{ id: '2', name: 'Reward 2', description: 'Description for Reward 2' },
// ... add more rewards here
].map((reward) => new Season(reward));

// Claim a reward
const season = rewards[0];
season.claimReward('user1', '1');
