import { deleteOldRecords } from './delete-old-records';
import User from '../models/user.model'; // Import your Mongoose model here

// Schedule the function to run every day using a cron job or any other scheduler.
deleteOldRecords(User);
