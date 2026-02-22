import { UserData } from '../user-data';
import { ArbitratorData } from '../arbitrator-data';

export function calculateReputationStakes(userData: UserData, arbitratorData: ArbitratorData): { userStake: number; arbitratorStake: number } {
const userReputation = userData.reputation;
const arbitratorReputation = arbitratorData.reputation;
const disputeValue = userData.disputeValue;
const userStake = (userReputation * disputeValue) / (2 * arbitratorReputation);
const arbitratorStake = disputeValue - userStake;

return { userStake, arbitratorStake };
}
