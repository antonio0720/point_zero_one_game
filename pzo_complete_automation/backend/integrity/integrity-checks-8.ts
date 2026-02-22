import * as ajv from 'ajv';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';

const ajvInstance = new ajv({ allErrors: true, removeAdditional: true });
addFormats(ajvInstance);

async function validateJsonFile(filename: string) {
const schemaYaml = await readFile(path.join(__dirname, 'schema.yaml'));
const schemaJson = yaml.load(schemaYaml) as any;
const validate = ajvInstance.compile(schemaJson);

try {
const data = await readFile(filename);
const valid = validate(JSON.parse(data));

if (!valid) {
console.error(`Validation of ${filename} failed:`);
console.error(validate.errors);
process.exit(1);
}

console.log(`${filename} validation succeeded`);
} catch (err) {
console.error(`An error occurred reading or parsing ${filename}:`, err);
process.exit(1);
}
}

function readFile(file: string): Promise<string> {
return new Promise((resolve, reject) => {
const readStream = fs.createReadStream(file);
let data = '';

readStream.on('error', reject);
readStream.on('data', (chunk) => {
data += chunk;
});
readStream.on('end', () => resolve(data));
});
}
