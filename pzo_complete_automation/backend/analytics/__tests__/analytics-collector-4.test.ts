import { AnalyticsCollector } from '../../analytics-collector';
import { TelemetryEvent } from '../../telemetry-event';
import { TelemetrySpineOptions } from '../telemetry-spine.options';
import { stubInterface } from 'ts-sinon';
import sinon from 'sinon';
import assert from 'assert';

describe('AnalyticsCollector', () => {
let collector: AnalyticsCollector;
const spyOptions = stubInterface(TelemetrySpineOptions);
const optionsInstance = new TelemetrySpineOptions();

beforeEach(() => {
collector = new AnalyticsCollector(optionsInstance);
sinon.stub(collector, 'sendEvent').resolves();
});

afterEach(() => {
sinon.restore();
});

it('should send a telemetry event', () => {
const event = new TelemetryEvent({ name: 'testEvent', properties: { testProperty: 'testValue' } });

collector.send(event);

assert.calledOnceWithExactly(collector.sendEvent, event);
});

it('should use the options provided to initialize the telemetry spine', () => {
const options = {
apiKey: 'testApiKey',
appId: 'testAppId',
endpoint: 'https://test-endpoint.com/telemetry',
};

spyOptions.returns(optionsInstance);
optionsInstance.apiKey = options.apiKey;
optionsInstance.appId = options.appId;
optionsInstance.endpoint = options.endpoint;

const collector = new AnalyticsCollector(optionsInstance);

assert.deepEqual(collector._telemetrySpineOptions, options);
});
});
