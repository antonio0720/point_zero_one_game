import { State } from './state';

export class CircuitBreaker {
private state: State;

constructor() {
this.state = new State();
}

public open(): void {
this.state.open();
}

public halfOpen(): boolean {
return this.state.halfOpen();
}

public close(): void {
this.state.close();
}

public execute(callable: () => void): void {
if (this.state.isOpen()) {
setTimeout(() => {
this.state.transitionToHalfOpen();
callable();
}, 5000);
} else if (this.state.isHalfOpen() && this.state.hasSuccessfulCalls(3)) {
this.state.transitionToClosed();
callable();
} else if (this.state.hasTooManyFailures()) {
this.open();
} else {
callable();
}
}
}

class State {
private state: 'closed' | 'halfOpen' | 'open';
private successfulCalls: number;
private failureCount: number;

constructor() {
this.state = 'closed';
this.successfulCalls = 0;
this.failureCount = 0;
}

public isClosed(): boolean {
return this.state === 'closed';
}

public isHalfOpen(): boolean {
return this.state === 'halfOpen';
}

public isOpen(): boolean {
return this.state === 'open';
}

public transitionToClosed(): void {
this.state = 'closed';
this.successfulCalls = 0;
this.failureCount = 0;
}

public transitionToHalfOpen(): void {
this.state = 'halfOpen';
}

public open(): void {
this.state = 'open';
}

public hasSuccessfulCalls(count: number): boolean {
return this.successfulCalls >= count;
}

public hasTooManyFailures(): boolean {
return this.failureCount > 5;
}

public recordSuccess(): void {
this.successfulCalls++;
this.failureCount = 0;
}

public recordFailure(): void {
this.failureCount++;
}
}
