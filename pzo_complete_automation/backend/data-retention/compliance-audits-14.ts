import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { Schedule } from 'node-cron';

// Data schema
const dataSchema = new mongoose.Schema({
fileName: String,
creationDate: Date,
});

const Data = mongoose.model('Data', dataSchema);

// Initialize Mongoose connection and schedule the task
mongoose.connect('<MONGODB_CONNECTION_STRING>').then(() => {
const cronJob = new Schedule('0 */12 * * *', async () => {
// Get all data older than 12 hours
const oldData = await Data.find({ creationDate: { $lt: new Date(Date.now() - 43200000) } }).exec();

// Delete data from MongoDB
for (const data of oldData) {
await data.remove();
}

// Iterate through files in the designated directory and delete those older than 12 hours
const directoryPath = path.join(__dirname, 'data_directory');
const fileNames = fs.readdirSync(directoryPath);

for (const fileName of fileNames) {
const filePath = path.join(directoryPath, fileName);
const stat = fs.statSync(filePath);
const fileAge = Date.now() - stat.birthtimeMs;

if (fileAge > 43200000) {
fs.unlinkSync(filePath);
}
}
});

cronJob.start();
});
