import { Arbitrator } from './arbitrator';
import { Dispute } from './dispute';
import { Request } from './request';

class CoopArbitration {
private arbitrators: Map<number, Arbitrator>;
private activeDisputes: Set<Dispute>;
private requestQueue: Queue<Request>;

constructor() {
this.arbitrators = new Map();
this.activeDisputes = new Set();
this.requestQueue = new Queue();
}

public registerArbitrator(id: number, arbitrator: Arbitrator): void {
if (!this.arbitrators.has(id)) {
this.arbitrators.set(id, arbitrator);
}
}

public submitRequest(request: Request): void {
this.requestQueue.enqueue(request);
}

public processRequests(): void {
while (!this.requestQueue.isEmpty()) {
const request = this.requestQueue.dequeue();
const arbitrators = [...this.arbitrators.values()];
const availableArbitrators = arbitrators.filter((arb) => !arb.isBusy());

if (availableArbitrators.length > 0) {
const arbitrator = availableArbitrators[Math.floor(Math.random() * availableArbitrators.length)];
this.activeDisputes.add(new Dispute(request, arbitrator));
arbitrator.startDispute(this.activeDisputes.size);
} else {
console.log("No available arbitrators to process the request.");
}
}
}

public handleDecision(disputeId: number, decision: string): void {
const dispute = this.activeDisputes.find((d) => d.id === disputeId);

if (dispute) {
dispute.resolve(decision);
this.activeDisputes.delete(dispute);
} else {
console.log("No such active dispute found.");
}
}
}
