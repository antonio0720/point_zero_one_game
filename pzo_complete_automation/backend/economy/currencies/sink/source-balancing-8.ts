import { Currency } from '../currency';
import { Account } from '../account';
import { EconomyEngine } from '../../economy-engine';

class SinkSourceBalancer8 extends EconomyEngine {
balance(accounts: Map<string, Account>, currencies: Map<string, Currency>) {
const sinkAccountId = this.config.get('sink_account');
const sourceAccountId = this.config.get('source_account');

if (!accounts.has(sinkAccountId) || !accounts.has(sourceAccountId)) {
throw new Error('Missing required accounts: sink and source.');
}

const sinkAccount = accounts.get(sinkAccountId);
const sourceAccount = accounts.get(sourceAccountId);

if (sinkAccount.balance === 0) {
this.log(`No balance in the sink account. Skipping synchronization.`);
return;
}

let balanceDifference = sinkAccount.balance - sourceAccount.balance;

while (balanceDifference !== 0) {
const transferAmount = Math.min(Math.abs(balanceDifference), sinkAccount.balance);

this.log(`Transferring ${transferAmount} from the sink account to the source account.`);

sinkAccount.withdraw(transferAmount);
sourceAccount.deposit(transferAmount);

balanceDifference = sinkAccount.balance - sourceAccount.balance;
}

this.log('Source and sink accounts are balanced.');
}
}

export { SinkSourceBalancer8 };
