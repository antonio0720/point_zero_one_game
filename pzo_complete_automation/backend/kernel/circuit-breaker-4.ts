import { CircuitBreaker } from 'googlesmithy/patterns';

class MyService {
constructor(private circuitBreaker: CircuitBreaker) {}

execute() {
return this.circuitBreaker.execute(() => {
// Your service logic here
});
}
}

const myCircuitBreaker = new CircuitBreaker({
name: 'myService',
failureThreshold: 50, // Failure threshold percentage
successThreshold: 10, // Success threshold percentage
waitDurationInOpenStateMilliseconds: 3000, // Time to wait before trying again in open state (ms)
waitDurationInHalfOpenStateMilliseconds: 1000, // Time to wait before transitioning from half-open to closed state (ms)
});

const myService = new MyService(myCircuitBreaker);
