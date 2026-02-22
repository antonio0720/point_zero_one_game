import * as fuzzystraw from 'fuzzystraw';
import { SimulationClient } from './simulation-client';

export class ActionFuzzer {
private client: SimulationClient;
private mutator = new fuzzystraw.Mutator();

constructor(client: SimulationClient) {
this.client = client;
}

public async start() {
const actionTemplate = await this.getActionTemplate();
let currentAction = actionTemplate;

while (true) {
const mutatedAction = this.mutate(currentAction);
await this.sendMutatedAction(mutatedAction);
currentAction = mutatedAction;
}
}

private async getActionTemplate() {
// Implement a method to fetch the action template from the server or elsewhere.
throw new Error('getActionTemplate not implemented');
}

private mutate(action: string) {
return this.mutator.germlineMutation(action, 5);
}

private async sendMutatedAction(mutatedAction: string) {
await this.client.sendAction(mutatedAction);
}
}
