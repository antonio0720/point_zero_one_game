import { promisify } from 'util';
import { inspect } from 'util';

interface CircuitBreakerOptions {
failureThreshold: number;
successThreshold: number;
timeout?: number;
defaultFallbackValue?: any;
}

class CircuitBreaker {
private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
private attempts: number;
private failureCount: number;
private successCount: number;
private timeoutId: NodeJS.Timeout;
private fallbackValue: any;

constructor(private service: () => Promise<any>, options: CircuitBreakerOptions) {
this.state = 'CLOSED';
this.attempts = 0;
this.failureCount = 0;
this.successCount = 0;
this.timeoutId = null;
this.fallbackValue = options.defaultFallbackValue || undefined;

this.failureThreshold = options.failureThreshold;
this.successThreshold = options.successThreshold;
this.timeout = options.timeout || 60 * 1000; // default timeout to 1 minute (60 seconds)

if (!this.service) {
throw new Error('Service function must be provided');
}
}

private async execute() {
try {
const result = await promisify(this.service)();
this.successCount++;
return result;
} catch (error) {
this.failureCount++;
this.handleState();
throw error;
}
}

private handleState() {
if (this.state === 'OPEN') {
clearTimeout(this.timeoutId);
setTimeout(() => {
this.state = 'HALF_OPEN';
this.attempts = 0;
}, this.timeout);
} else if (this.state !== 'CLOSED' && this.failureCount >= this.failureThreshold) {
this.state = 'OPEN';
} else if (this.state !== 'CLOSED' && this.successCount >= this.successThreshold) {
this.state = 'HALF_OPEN';
}
}

@promisify
public async call() {
if (this.timeoutId) clearTimeout(this.timeoutId);

this.attempts++;
const result = await this.execute();
return result || this.fallbackValue;
}
}

// Usage example:
class Service {
public async someMethod() {
// Your service implementation goes here...
}
}

const service = new Service().someMethod;
const circuitBreaker = new CircuitBreaker(service, { failureThreshold: 5, successThreshold: 10 });

try {
const result = await circuitBreaker.call();
console.log(`Result: ${inspect(result)}`);
} catch (error) {
console.error(`Error: ${error.message}`);
}
