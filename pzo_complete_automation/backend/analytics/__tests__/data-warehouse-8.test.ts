import { DataWarehouse } from '../data-warehouse';
import { DataSource1 } from '../../datasources/DataSource1';
import { DataSource2 } from '../../datasources/DataSource2';

jest.mock('../../datasources/DataSource1', () => ({
DataSource1: jest.fn().implementation({
// Mock implementation for DataSource1
}),
}));

jest.mock('../../datasources/DataSource2', () => ({
DataSource2: jest.fn().implementation({
// Mock implementation for DataSource2
}),
}));

describe('DataWarehouse', () => {
let dataWarehouse: DataWarehouse;

beforeEach(() => {
dataWarehouse = new DataWarehouse();
});

it('should initialize with empty sources', () => {
expect(dataWarehouse.sources).toEqual([]);
});

it('should add a data source to the warehouse', () => {
const dataSource1 = new DataSource1();
dataWarehouse.addDataSource(dataSource1);

expect(dataWarehouse.sources).toContain(dataSource1);
});

it('should throw an error when trying to add a duplicate data source', () => {
const dataSource1 = new DataSource1();
dataWarehouse.addDataSource(dataSource1);

expect(() => dataWarehouse.addDataSource(dataSource1)).toThrowError('Duplicate data source');
});

// Add more test cases specific to your DataWarehouse implementation here...
});
