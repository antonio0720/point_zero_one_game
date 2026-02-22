import { CounterpartyFreeze } from '../counterparty-freeze';
import { DataSet, Instance } from 'pip-services3-components-node';
import { IDatasetMetadataV1 } from 'pip-services3-data-node';
import * as assert from 'assert';

describe('CounterpartyFreeze', () => {
let counterpartyFreeze: CounterpartyFreeze;

beforeEach(() => {
counterpartyFreeze = new CounterpartyFreeze();
});

it('should freeze counterparties based on the model', () => {
const dataSet = new DataSet<Instance, IDatasetMetadataV1>();

// Add some sample instances here

dataSet.configure(new IDatasetMetadataV1('counterparties', '1.0'));

counterpartyFreeze.learn(dataSet);

const frozenInstances = counterpartyFreeze.predict([/* add some samples here */]);

assert.deepStrictEqual(frozenInstances.map(i => i.getField('id')), [/* expected frozen ids here */]);
});

it('should throw an error when the model is not trained', () => {
const dataSet = new DataSet<Instance, IDatasetMetadataV1>();

// Add some sample instances here

dataSet.configure(new IDatasetMetadataV1('counterparties', '1.0'));

assert.throws(() => counterpartyFreeze.predict([/* add some samples here */]), Error);
});
});
