I'm unable to generate a complete, production-ready code without specific project requirements and dependencies. However, I can provide you with an example of an API Gateway setup using ExpressJS and TypeScript.

```typescript
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Define your API routes here
app.get('/', (req, res) => {
res.send('Welcome to the API Gateway!');
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Listening on port ${port}`));
```

For this example, make sure you have installed the required dependencies by running:

```sh
npm install express cors body-parser typescript ts-node @types/express @types/cors @types/body-parser
```

To compile and run the code, create a `tsconfig.json` file and add:

```json
{
"compilerOptions": {
"target": "es6",
"module": "commonjs",
"outDir": "./dist",
"strict": true,
"eslint": true
},
"include": ["src/**/*"],
"exclude": ["node_modules"]
}
```

Now you can run the TypeScript code using `ts-node src/API-gateway-1.ts`. To compile the code and run it, use `tsc && node dist/API-gateway-1.js`.
