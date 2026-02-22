import * as _ from 'lodash';
import { IBatchOperation } from './interfaces/IBatchOperation';

export function batchOperations<T>(items: T[], operations: Array<IBatchOperation<T>>): T[] {
return operations.reduce((accumulator, operation) => {
const { transform, sortBy, sortDirection = 'asc' } = operation;
accumulator = _(accumulator).map(transform).value();

if (sortBy && sortDirection === 'desc') {
accumulator = _.orderBy(accumulator, [sortBy], ['desc']);
} else if (sortBy) {
accumulator = _.orderBy(accumulator, [sortBy], ['asc']);
}

return accumulator;
}, items);
}
