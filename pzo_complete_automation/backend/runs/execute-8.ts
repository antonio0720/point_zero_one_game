```typescript
import express from 'express';
const app = express();

app.get('/', (req, res) => {
const result = yourFunction(); // Your function goes here
res.send(result);
});

app.listen(3000, () => console.log('Server is running on port 3000'));
```

In this example, the server listens for GET requests at the root URL ("/"). When a request is received, it calls `yourFunction()`, which you need to replace with your own function. The result of that function is sent back as the response. If you want to run your function asynchronously, make sure to handle any potential promises or async functions appropriately.
