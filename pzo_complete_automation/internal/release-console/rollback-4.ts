import * as fs from 'fs';

interface RollbackOptions {
oldDataPath: string;
newDataPath: string;
rollbackDataPath: string;
}

function rollback(options: RollbackOptions) {
const { oldDataPath, newDataPath, rollbackDataPath } = options;

// Read the old data file
fs.readFile(oldDataPath, (err, oldData) => {
if (err) {
console.error(`Error reading ${oldDataPath}: ${err}`);
return;
}

// Write the old data to the rollback data file
fs.writeFile(rollbackDataPath, oldData, 'binary', (err) => {
if (err) {
console.error(`Error writing to ${rollbackDataPath}: ${err}`);
return;
}

// Delete the new data file
fs.unlink(newDataPath, (err) => {
if (err) {
console.error(`Error deleting ${newDataPath}: ${err}`);
return;
}

console.log('Rollback complete.');
});
});
});
}
