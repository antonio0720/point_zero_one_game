import express from 'express';
import { Season } from './season.model';
import { scheduleSeasons } from './season-scheduling.service';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

interface SeasonData {
startDate: Date;
endDate: Date;
}

app.post('/schedule', async (req, res) => {
try {
const seasonData: SeasonData = req.body;
const season = new Season(seasonData.startDate, seasonData.endDate);
await scheduleSeasons(season);
res.status(201).send('Season scheduled successfully.');
} catch (error) {
console.error(error);
res.status(500).send('An error occurred while scheduling the season.');
}
});

app.listen(port, () => {
console.log(`Season Scheduler is running on port ${port}`);
});
