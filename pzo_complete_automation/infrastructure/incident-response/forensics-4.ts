import * as fs from 'fs';
import * as path from 'path';
import * as md5 from 'md5';
import * as moment from 'moment';

interface FileForensics {
filePath: string;
lastModified: Date;
size: number;
md5Hash: string;
}

function getFileStats(filePath: string): Promise<FileForensics> {
return new Promise((resolve, reject) => {
fs.stat(filePath, (err, stats) => {
if (err) return reject(err);

const lastModified = moment(stats.mtime).toISOString();
const size = stats.size;
const md5Hash = md5(fs.readFileSync(filePath));

resolve({ filePath, lastModified, size, md5Hash });
});
});
}

function analyzeDirectory(directory: string): Promise<FileForensics[]> {
return new Promise((resolve) => {
fs.readdir(directory, (err, files) => {
if (err) return resolve([]);

const fileStatsPromises = files.map((file) => getFileStats(path.join(directory, file)));
Promise.all(fileStatsPromises).then((results) => resolve(results));
});
});
}

// Example usage
analyzeDirectory('/path/to/the/directory')
.then((files) => console.log(files))
.catch((err) => console.error(err));
