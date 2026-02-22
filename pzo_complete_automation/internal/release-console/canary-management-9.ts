import * as express from 'express';
import bodyParser from 'body-parser';
import { CanaryService } from './services/canary.service';

const app = express();
app.use(bodyParser.json());

const canaryService = new CanaryService();

app.post('/release', async (req, res) => {
try {
const result = await canaryService.release(req.body);
res.send(result);
} catch (error) {
res.status(500).send({ error: error.message });
}
});

app.post('/rollback', async (req, res) => {
try {
const result = await canaryService.rollback(req.body);
res.send(result);
} catch (error) {
res.status(500).send({ error: error.message });
}
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
