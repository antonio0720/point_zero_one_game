interface DataWarehouse14 {
id: number;
name: string;
created_at: Date;
updated_at: Date;

factTables: Array<FactTable>;
dimensionTables: Array<DimensionTable>;
relationships: Array<Relationship>;
}

interface FactTable {
id: number;
name: string;
description?: string;
dataWarehouseId: number;
}

interface DimensionTable {
id: number;
name: string;
description?: string;
dataWarehouseId: number;
}

interface Relationship {
id: number;
factTableId: number;
dimensionTableId: number;
foreignKeyColumnName: string;
primaryKeyColumnName: string;
created_at: Date;
updated_at: Date;
}
