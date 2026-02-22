import axios from 'axios';

type Challenge8Response = {
data: {
id: number;
name: string;
description: string;
imageUrl: string;
rewardPoints: number;
}[];
};

async function fetchChallenges(): Promise<Challenge8Response['data']> {
const response = await axios.get('https://api.example.com/challenges');
return response.data;
}

function calculateRewardPoints(challenges: Challenge8Response['data'], completedChallengesIds: number[]): number {
return Math.floor(
challenges
.filter((challenge) => completedChallengesIds.includes(challenge.id))
.reduce((total, challenge) => total + challenge.rewardPoints, 0)
);
}

async function processUserData(userId: string): Promise<number> {
const challenges = await fetchChallenges();
const completedChallengesResponse = await axios.get(`https://api.example.com/users/${userId}/completed-challenges`);
const completedChallengesIds = completedChallengesResponse.data.map(({ challengeId }) => Number(challengeId));
return calculateRewardPoints(challenges, completedChallengesIds);
}
