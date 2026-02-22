```typescript
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Router, Request, Response } from 'express';
import { handleApiCalls } from './apiCallHandlers'; // Import your custom API call handling function

const app = express();
app.use(bodyParser.json());
app.use(cors());

const apiRouter = Router();

// Define routes here
apiRouter.post('/your-endpoint', handleApiCalls);

// Use the API router
app.use('/api', apiRouter);

export default app;
```

In your project, replace `'./apiCallHandlers'` with the correct path to the file containing the implementation for handling requests to your APIs. This example uses a simple POST request as an example, but you can modify it according to your needs.

For production-ready code, consider including middleware for error handling, logging, and rate limiting, among other things. Additionally, it's a good practice to separate the concerns between the gateway and the handlers, use dependency injection, and follow best practices for creating scalable and maintainable applications.
