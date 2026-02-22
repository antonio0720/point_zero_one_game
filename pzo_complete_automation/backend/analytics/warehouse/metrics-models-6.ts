import { MetadataBuilder } from '@google-cloud/bigquery';
import * as _ from 'lodash';

export class ECommerceMetricsModel {
private readonly _tableName: string;

constructor(tableName: string) {
this._tableName = tableName;
}

public getSalesByProduct(): MetadataBuilder {
const query = `
SELECT product_id, SUM(revenue) as total_sales
FROM ${this._tableName}
GROUP BY product_id`;

return this.buildMetadataAndQuery(query);
}

public getAverageOrderValue(): MetadataBuilder {
const query = `
SELECT AVG(revenue) as average_order_value
FROM ${this._tableName}`;

return this.buildMetadataAndQuery(query);
}

public getTopSellingProducts(n: number): MetadataBuilder {
const query = `
SELECT product_id, SUM(revenue) as total_sales
FROM ${this._tableName}
GROUP BY product_id
ORDER BY total_sales DESC
LIMIT ${n}`;

return this.buildMetadataAndQuery(query);
}

private buildMetadataAndQuery(query: string): MetadataBuilder {
const metadata = new MetadataBuilder();
metadata.addSql(query);
return metadata;
}
}
