import { check } from 'k6';
import http from 'k6/http';
import { Chaos } from '@k6/chaos';
const chaos = new Chaos();

export let options = {
vus: 100, // Virtual Users
duration: '30s' // Test Duration
};

let sloBreachedCount = 0;

export default function () {
const response = http.get('http://your-service-url');
check(response, { 'status is 200': (r) => r.status === 200 });

chaos.setCPUUsage({ minPercent: 70, timePercent: 10 }); // Set CPU usage to 70% for 10% of the test duration
chaos.setRam('+100MB'); // Add 100 MB of memory pressure
chaos.networkLatencyTest({ minRoundTripTime: '50ms', timePercent: 20 }); // Increase network latency by 50ms for 20% of the test duration
}

export function handleSummary(data) {
sloBreachedCount = data.vus - data.failedVUs;
console.log(`Total VUs: ${data.vus}, Failed VUs: ${data.failedVUs}, Breached SLO VUs: ${sloBreachedCount}`);
}
