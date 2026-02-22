import express from 'express';
import helmet from 'helmet';

const app = express();
app.use(helmet());

// Define a middleware function to validate input data
function validateInput(req, res, next) {
const allowedHeaders = new Set(['Content-Type']);
const headers = req.headers;
if (!headers) {
return res.status(400).send('Missing required headers');
}
for (const header of headers.keys()) {
if (!allowedHeaders.has(header)) {
return res.status(400).send(`Invalid header "${header}"`);
}
}
next();
}

// Define a route with input validation
app.post('/myroute', validateInput, (req, res) => {
// Your business logic here
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
