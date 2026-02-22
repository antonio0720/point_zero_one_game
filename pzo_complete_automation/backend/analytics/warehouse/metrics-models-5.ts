import { BigQuery } from '@google-cloud/bigquery';
import { DateTime } from 'luxon';

const bigquery = new BigQuery();
const datasetId = 'your_dataset_id';
const tableId = 'your_table_id';

async function queryData(startDate: DateTime, endDate: DateTime) {
const query = `
SELECT
metric1 AS metric1,
metric2 AS metric2,
...
metricN AS metricN,
DATE(_TABLE_TIMESTAMP) AS date
FROM ${datasetId}.${tableId}
WHERE _PARTITIONTIME BETWEEN '${startDate.toISO()}T00:00:00Z' AND '${endDate.plus({ days: 1 }).toISO()}T00:00:00Z'
`;

const options = {
query,
};

const [rows] = await bigquery.query(options);

return rows.map((row) => ({
date: row.get('date'),
metric1: row.get('metric1'),
... // Add the rest of your metrics as properties
}));
}
