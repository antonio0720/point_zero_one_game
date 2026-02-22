import express from 'express';
import superagent from 'superagent';
import { Router } from 'express';

const app = express();
const router = Router();
const port = process.env.PORT || 3000;

// Your API key for the sharing service goes here
const apiKey = 'YOUR_API_KEY';

router.get('/share-loop/:url', async (req, res) => {
const url = req.params.url;

try {
const response = await superagent.post('https://api.sharing-service.com/create')
.set('Authorization', `Bearer ${apiKey}`)
.send({ url });

if (response.ok) {
res.status(200).json({ success: true, loopId: response.body.loopId });
} else {
res.status(500).json({ error: 'Failed to create share loop' });
}
} catch (error) {
console.error(error);
res.status(500).json({ error: 'Internal server error' });
}
});

app.use('/growth/share-loops-3', router);

app.listen(port, () => {
console.log(`Server is running on port ${port}`);
});
