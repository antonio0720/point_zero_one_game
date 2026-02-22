import fs from 'fs';
import path from 'path';
import md5 from 'md5';
import dayjs from 'dayjs';

class ForensicModule {
private logFile: string;

constructor() {
this.logFile = path.join(__dirname, 'forensic_logs.txt');
}

public log(message: string) {
const timestamp = dayjs().format();
const hashedMessage = md5(message);
fs.appendFileSync(this.logFile, `${timestamp} | ${hashedMessage} | ${message}\n`);
}

public getLogs() {
return new Promise((resolve, reject) => {
fs.readFile(this.logFile, 'utf-8', (err, data) => {
if (err) {
return reject(err);
}
resolve(data.split('\n'));
});
});
}

public extractSystemInfo() {
// Add your system information extraction code here
// Return the extracted data as an object or a promise resolving with that object
}
}

export default ForensicModule;
