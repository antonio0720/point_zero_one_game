import { Injectable } from '@nestjs/common';
import { INestApplication } from '@nestjs/core';
import { EntityManager, InjectEntityManager } from 'typeorm';
import { Currency } from './currency.entity';
import { Transaction } from './transaction.entity';

interface Balance {
source: number;
sink: number;
}

@Injectable()
export class EconomyService {
constructor(private readonly manager: EntityManager) {}

async initialize(app: INestApplication): Promise<void> {
const balances = await this.calculateBalances();
await this.applyBalances(balances);
}

private async calculateBalances(): Promise<Balance[]> {
// Query all transactions and aggregate by source and sink currencies to calculate the balance
const transactions = await this.manager
.createQueryBuilder(Transaction, 'transaction')
.leftJoinAndSelect('transaction.sourceCurrency', 'currencySource')
.leftJoinAndSelect('transaction.sinkCurrency', 'currencySink')
.getMany();

return transactions.reduce((balances: Balance[], transaction) => {
const sourceBalance = balances.find(b => b.source === transaction.sourceCurrency.id);
const sinkBalance = balances.find(b => b.sink === transaction.sinkCurrency.id);

if (!sourceBalance) {
sourceBalance = { source: 0, sink: 0 };
balances.push(sourceBalance);
}

if (!sinkBalance) {
sinkBalance = { source: 0, sink: 0 };
balances.push(sinkBalance);
}

sourceBalance.source += transaction.amount;
sinkBalance.sink -= transaction.amount;

return balances;
}, []);
}

private async applyBalances(balances: Balance[]): Promise<void> {
// Iterate through each balance and apply the difference to their respective currencies using transactions
for (const balance of balances) {
const sourceDifference = balance.source - balance.sink;

if (sourceDifference !== 0) {
await this.manager
.createQueryBuilder(Transaction, 'transaction')
.insert()
.into(Transaction)
.values([
{
amount: sourceDifference > 0 ? sourceDifference : -sourceDifference,
sourceCurrency: balance.source,
sinkCurrency: balance.sink,
},
])
.execute();
}
}
}
}
