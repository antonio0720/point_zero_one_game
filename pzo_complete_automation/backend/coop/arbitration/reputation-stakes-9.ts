import { Arbitrator } from "../arbitrator";
import { ReputationService } from "../services/reputation-service";
import { Stake } from "../models/stake";

class ReputationStakes9 implements Arbitrator {
private reputationService: ReputationService;

constructor() {
this.reputationService = new ReputationService();
}

async decide(dispute: any): Promise<Stake> {
const reputationA = await this.reputationService.getReputation(dispute.participantA);
const reputationB = await this.reputationService.getReputation(dispute.participantB);

if (reputationA > reputationB) {
return new Stake(dispute.participantA, dispute.amount * 0.7);
} else if (reputationB > reputationA) {
return new Stake(dispute.participantB, dispute.amount * 0.7);
} else {
// If both parties have the same reputation, decide based on other factors like history of disputes or random chance
const randomNumber = Math.random();
if (randomNumber < 0.5) {
return new Stake(dispute.participantA, dispute.amount * 0.5);
} else {
return new Stake(dispute.participantB, dispute.amount * 0.5);
}
}
}
}

export { ReputationStakes9 };
