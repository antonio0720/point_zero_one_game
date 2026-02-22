import * as eosio from 'eosio.js';
import * as _ from 'lodash';

export interface ActionLedger {
code: 'actionledger4';
scope: string;
table: 'actions';
type: 'table';
columns: {
action_id: eosio.TableColumn<eosio.Name>({ primary_key: true }),
proposer: eosio.TableColumn<eosio.AccountName>,
receiver: eosio.TableColumn<eosio.AccountName>,
net_weight: eosio.TableColumn<number>,
fee: eosio.TableColumn<number>,
time: eosio.TableColumn<Date>,
};
}

export interface Governance {
code: 'gov';
scope: string;
table: 'proposals';
type: 'table';
columns: {
id: eosio.TableColumn<eosio.Name>({ primary_key: true }),
proposer: eosio.TableColumn<eosio.AccountName>,
proposal: eosio.TableColumn<string>,
start_date: eosio.TableColumn<Date>,
end_date: eosio.TableColumn<Date>,
required_quorum: eosio.TableColumn<number>,
vote_threshold: eosio.TableColumn<number>,
current_votes: eosio.TableColumn<eosio.NameArray>,
total_voters: eosio.TableColumn<number>,
state: eosio.TableColumn<string>,
};
}

export interface CECLV1 {
code: 'cecl';
scope: string;
table: 'assets';
type: 'table';
columns: {
id: eosio.TableColumn<eosio.Name>({ primary_key: true }),
owner: eosio.TableColumn<eosio.AccountName>,
asset_name: eosio.TableColumn<string>,
quantity: eosio.TableColumn<number>,
};
}

export class ActionLedger4 extends eosio.Contract {
constructor() { super('eosio.system'); }

@eosio.action(
{ onBehalfOf: 'proposer' },
{ authorization: ['active'] }
)
async proposeAction(@eosio.Action() action: eosio.Action) {
const actionLedger = await this.getTable<ActionLedger>('actions');
const { proposer, receiver, net_weight, fee } = action.action;
if (!proposer || !receiver || !net_weight || !fee) {
throw new Error('Invalid action data.');
}
await actionLedger.add({
action_id: eosio.Name(_.uniqueId('action')),
proposer,
receiver,
net_weight,
fee,
time: new Date(),
});
}

@eosio.action(
{ onBehalfOf: 'proposer' },
{ authorization: ['active'] }
)
async proposeGovernanceProposal(@eosio.Action() action: eosio.Action) {
const proposer = action.account;
const proposal = action.data[0].toString();
const start_date = new Date(action.data[1].toNumber());
const end_date = new Date(action.data[2].toNumber());
const required_quorum = action.data[3].toNumber();
const vote_threshold = action.data[4].toNumber();
const governance = await this.getTable<Governance>('proposals');
await governance.add({
id: eosio.Name(_.uniqueId('proposal')),
proposer,
proposal,
start_date,
end_date,
required_quorum,
vote_threshold,
current_votes: [],
total_voters: 0,
state: 'open',
});
}

// Additional methods for CECLV1 integration and governance vote processing omitted for brevity.
}
