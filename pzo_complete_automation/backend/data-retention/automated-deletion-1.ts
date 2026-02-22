import mongoose from 'mongoose';

const DataSchema = new mongoose.Schema({
createdAt: { type: Date, required: true },
data: String,
});

DataSchema.pre('save', function (next) {
this.updatedAt = new Date();
next();
});

DataSchema.post('findOneAndDelete', async function (doc) {
const ageInDays = Math.round(Math.abs((new Date().getTime() - doc.createdAt.getTime()) / (1000 * 60 * 60 * 24)));

if (ageInDays > 7) { // Adjust the number of days according to your policy
console.log(`Deleting document with id ${doc._id}`);
}
});

const Data = mongoose.model('Data', DataSchema);

// Connect to MongoDB and run the script
mongoose.connect('mongodb://localhost/test-db', { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to database'))
.catch(err => console.error('Failed to connect to database', err));
