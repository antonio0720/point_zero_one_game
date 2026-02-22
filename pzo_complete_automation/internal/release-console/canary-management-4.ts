import * as express from 'express';
import bodyParser from 'body-parser';
import { canaryService } from './canary.service';

const app = express();
app.use(bodyParser.json());

// Start Canary Release
app.post('/start-release', async (req, res) => {
try {
await canaryService.startRelease(req.body);
res.status(200).send('Canary release started');
} catch (error) {
res.status(500).send(error.message);
}
});

// Rollback Canary Release
app.post('/rollback', async (req, res) => {
try {
await canaryService.rollback(req.body);
res.status(200).send('Canary release rolled back');
} catch (error) {
res.status(500).send(error.message);
}
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));
