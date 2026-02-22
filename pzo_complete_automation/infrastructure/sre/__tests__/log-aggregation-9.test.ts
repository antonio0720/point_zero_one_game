import { logAggregation } from './log-aggregation';
import * as logSources from './log-sources';
import { Logger } from 'winston';
import 'jest-extended';

describe('Log Aggregation', () => {
let logger: Logger;

beforeAll(() => {
logger = new (require('winston')).Logger({ transports: [] });
});

it('should aggregate logs from multiple sources correctly', () => {
const source1 = jest.fn().mockReturnValue(['Log 1 from Source 1']);
const source2 = jest.fn().mockReturnValue(['Log 2 from Source 2']);

logSources.addSource('source1', source1);
logSources.addSource('source2', source2);

logAggregation();

expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(['Log 1 from Source 1', 'Log 2 from Source 2'].join('\n')));
});

it('should not aggregate logs if a source fails', () => {
const failingSource = jest.fn().mockImplementationOnce(() => {
throw new Error('Failed to get logs');
}).mockReturnValue(['Log from Failing Source']);

logSources.addSource('failing-source', failingSource);

expect(() => {
logAggregation();
}).toThrow('Failed to get logs');
});
});
