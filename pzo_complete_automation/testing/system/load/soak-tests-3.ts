```bash
npm install jest stress-test express
```

Then create your server in `server.ts`:

```typescript
import express from 'express';
const app = express();
const port = 3000;

app.get('/', (req, res) => {
res.send('Hello World!');
});

app.listen(port, () => {
console.log(`Server is running at http://localhost:${port}`);
});
```

Now, create a test file `soak-tests-3.ts` for the Soak tests:

```typescript
import * as request from 'supertest';
import { app } from './server';
import stressTest from 'stress-test';

describe('Soak tests', () => {
it('should handle multiple requests with a large number of clients', async () => {
const clientCount = 50;
await stressTest({
clients: clientCount,
maxRequests: 1000,
uri: `http://localhost:3000`,
postData: {},
headers: {}
});
});
});
```

Lastly, add the test script in your `package.json`:

```json
"scripts": {
"test": "jest",
"soak-tests": "jest --runInBand --coverage --watchAll=true"
}
```

Run the tests using the following command:

```bash
npm run soak-tests
```
