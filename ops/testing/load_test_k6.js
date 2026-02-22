Here is the `ops/testing/load_test_k6.js` file based on your specifications:

```javascript
#!/usr/bin/env node

const k6 = require('k6');
const http = require('k6/http');

// Load test configuration
const vus = 10000; // Number of virtual users (concurrent users)
const duration = '30s'; // Duration of the load test
const apiUrls = [
  'https://game-api.pointzeroonedigital.com/verification',
  'https://game-api.pointzeroonedigital.com/leaderboard',
  // Add more game APIs here as needed
];

// Function to execute the test for each API
function runTest(url) {
  k6.options = {
    vus,
    duration,
  };

  const response = http.get(url);

  // Verify p95 response time is less than 500ms
  k6.check(response, {
    'p95 response time is less than 500ms': (r) => r.check(r => r.p95('response_time') < 500),
  });
}

// Initialize the load test for each API
apiUrls.forEach(runTest);

// Export the script as idempotent and rollback-able
k6.exit();
