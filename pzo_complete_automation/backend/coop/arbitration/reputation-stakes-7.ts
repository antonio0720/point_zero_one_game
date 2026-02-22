type Player = {
id: string;
reputationScore: number;
shares: number;
};

function calculateReputationStakes(players: Player[], totalShares: number): Map<string, number> {
const stakesMap = new Map<string, number>();

players.forEach((player) => {
const playerStake = (player.reputationScore * player.shares) / totalShares;
stakesMap.set(player.id, playerStake);
});

return stakesMap;
}
