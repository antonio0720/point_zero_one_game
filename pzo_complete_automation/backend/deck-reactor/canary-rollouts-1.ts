Here is a TypeScript example for Canary Rollouts in a Node.js application using Express and a hypothetical service named `DeckService`. The code assumes you have a load balancer that distributes traffic between the canary and main services.

```typescript
import express from 'express';
import { DeckService } from './services/deck-service';

const app = express();
const canaryRatio = 0.2; // Adjust as needed
const canaryDeckService = new DeckService('canary');
const mainDeckService = new DeckService('main');

app.get('/api/deck', (req, res) => {
const random = Math.random();
if (random <= canaryRatio) {
canaryDeckService.getDeck(req, res);
} else {
mainDeckService.getDeck(req, res);
}
});

// Add more routes as needed

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
```

This code defines an Express application that listens for GET requests at `/api/deck`. For each request, it randomly selects whether to use the canary service (`canaryDeckService`) or the main service (`mainDeckService`). The ratio of requests going to the canary service is determined by the `canaryRatio` variable.

For simplicity, I've used a hypothetical `DeckService` class with a `getDeck()` method. You will need to implement this and other necessary services based on your application requirements.
