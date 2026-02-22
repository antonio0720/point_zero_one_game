import * as loadtest from 'loadtest';
import * as fs from 'fs';

// Define test settings
const duration = 60; // Test duration in seconds (60 seconds by default)
const clients = 100; // Number of clients to simulate (100 clients by default)
const testName = 'chaos-engineering-9';

// Define the test script for each client
function testScript() {
// Replace with your own server API endpoint or function call
const response = fs.readFileSync('path/to/your/file.txt', 'utf8');
return `${response}\nClient: ${process.pid}`;
}

// Set up the load test
loadtest(duration, clients)
.name(testName)
.script(testScript)
.run()
.then(() => console.log(`Test "${testName}" completed successfully!`))
.catch((error) => console.error(`Error during test "${testName}":`, error));
