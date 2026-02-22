import * as eosio from '@eosio/eos';

const chain_id = 'eos'
const contract_name = 'actionledger2'
const action_type_table = 'actionlog';
const action_index = 'byaction';
const sequence_table = 'sequencelog';
const sequence_index = 'bysender';
const owner_table = 'owner';
const owner_index = 'byaccount';
const authorization_table = 'authorization';
const authorization_index = 'byactor';
const action_data_table = 'actiondata';
const action_data_index = 'byaction';

class ActionLedger2 extends eosio.Contract {
constructor() {
super({
accounts: [
{
name: `${contract_name}`,
permission: {
actor: contract_name,
permission: 'active'
}
},
],
code: {
raw: [...], // your contract ABI here
language: 'wasm',
},
});
}

async init(self) {
const start_sequence = await self.get_sequence('genesis');
await this._setSequence('genesis', start_sequence + 1);
}

@eosio.action(action_type_table, action_index)
async logAction( { account, data, sequence, author } ) {
const next_sequence = await this._getNextSequence(account);
if (next_sequence > sequence) throw eosio.Error403('Invalid sequence number');

// save action to the actionlog table
// ...

await this._setSequence(account, sequence + 1);
await this._emit('action', { account, data });
}

@eosio.action(sequence_table, sequence_index)
async setSequence( { account, sequence } ) {
const old_sequence = await this._getSequence(account);
if (old_sequence !== undefined && old_sequence >= sequence) throw eosio.Error403('Invalid sequence number');

// save new sequence to the sequencelog table
// ...

await this._emit('sequence', { account, sequence });
}

async _getNextSequence(account) {
const current = await this.getTableRow(owner_table, owner_index, { account });
return current ? current.next_sequence : 1;
}

async _setSequence(account, sequence) {
await this.pushAction({
account: 'eosio',
name: 'transfer',
authorization: [{ actor: contract_name, permission: 'active' }],
data: {
from: 'eosio',
to: account,
quantity: '1 EOS',
memo: JSON.stringify({ next_sequence: sequence })
}
});
}

async _getSequence(account) {
const current = await this.getTableRow(owner_table, owner_index, { account });
return current ? current.sequence : undefined;
}

// helper functions for getting and setting table rows
async getTableRow<T>(table: string, index: string, key: T) {
const rows = await this.getTableRows<T>({
scope: contract_name,
code: contract_name,
table,
json: true,
uppercase: false,
index: index,
key
});
return rows && rows[0];
}

async getTableRows<T>(options: any) {
const code = this.codeHash(contract_name);
options['code'] = code;
const results = await this.chain.getTableRows<T>(options);
return results;
}
}

export default ActionLedger2;
