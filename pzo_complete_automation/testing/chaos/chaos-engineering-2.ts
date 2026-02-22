```typescript
import { ChaosMonkey } from 'chaos-monkey';
import { app } from './app';

const monkey = new ChaosMonkey();

// Configure the Chaos Monkey to terminate a random process every 5 seconds
monkey.on('SIGNAL', () => process.exit(0));
monkey.terminateInterval = 5000;

// Start the app and the Chaos Monkey
app().listen(3000, () => {
console.log('App listening on port 3000!');
monkey.start();
});
```

This example will start your application on port 3000 and every 5 seconds it will terminate a random process to simulate failures in a production environment. You can adjust the `terminateInterval` value to increase or decrease the frequency of failures.

Remember to handle errors gracefully in your application code to make it resilient against failures caused by the Chaos Monkey.
