import { MetadataBuilder } from '@google-cloud/bigquery';
import * as bigquery from '@google-cloud/bigquery';

class DailySalesMetric {
private client: bigquery.Client;
private datasetId = 'analytics_dataset';
private tableId = 'sales_data';

constructor(options: { projectId: string }) {
this.client = new bigquery.Client({ projectId: options.projectId });
}

public async getDailySales() {
const query = `
SELECT
DATE(_timestamp) AS date,
SUM(amount) AS total_sales
FROM ${this.datasetId}.${this.tableId}
GROUP BY date
ORDER BY date ASC;
`;

const results = await this.client.queryAsync(query);
const rows = results[0].data.map((row) => row as any);

return rows.map((row) => ({ date: row.date, sales: row.total_sales }));
}
}
