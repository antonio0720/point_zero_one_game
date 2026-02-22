import { Deal } from './Deal';
import { Player } from './Player';

type Syndicate = {
id: string;
name: string;
members: Set<Player>;
currentDeal?: Deal;
};

class SyndicateManager {
private syndicates: Map<string, Syndicate> = new Map();

public createSyndicate(id: string, name: string): void {
const syndicate: Syndicate = { id, name, members: new Set() };
this.syndicates.set(id, syndicate);
}

public joinSyndicate(player: Player, syndicateId: string): boolean {
const syndicate = this.syndicates.get(syndicateId);

if (!syndicate) return false;

syndicate.members.add(player);
return true;
}

public leaveSyndicate(player: Player, syndicateId: string): boolean {
const syndicate = this.syndicates.get(syndicateId);

if (!syndicate) return false;

syndicate.members.delete(player);
return true;
}

public getSyndicateDeal(syndicateId: string): Deal | undefined {
const syndicate = this.syndicates.get(syndicateId);
return syndicate?.currentDeal || undefined;
}

public assignDealToSyndicate(deal: Deal, syndicateId: string): boolean {
const syndicate = this.syndicates.get(syndicateId);

if (!syndicate) return false;

syndicate.currentDeal = deal;
return true;
}
}
