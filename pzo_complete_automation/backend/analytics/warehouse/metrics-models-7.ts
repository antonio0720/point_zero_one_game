import { MetricsModel } from '@your-project/analytics-common';

export class SalesMetricsModel extends MetricsModel {
constructor() {
super('Sales');

this.defineMetric('TotalRevenue', {
label: 'Total Revenue',
formula: `sum(transactions.amount)`,
description: 'The total revenue from all transactions.',
});

this.defineMetric('AverageOrderValue', {
label: 'Average Order Value',
formula: `avg(transactions.amount)`,
description: 'The average amount spent per transaction.',
});

this.defineMetric('TotalTransactionsCount', {
label: 'Total Transactions Count',
formula: `count(distinct transactions.id)`,
description: 'The total number of unique transactions.',
});

// Assuming there are tables named 'transactions' and 'users' in the data warehouse schema
this.defineDimension('User', {
label: 'User',
referencedTable: 'users',
uniqueIdentifierField: 'userId',
});
}
}
