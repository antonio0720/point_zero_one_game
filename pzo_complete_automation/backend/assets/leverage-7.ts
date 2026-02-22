import { Client } from 'leverage';
import * as path from 'path';
import * as fs from 'fs';

const client = new Client({
baseUrl: '/assets/',
});

async function registerAssets() {
const imagesDir = path.join(__dirname, 'images');
const files = fs.readdirSync(imagesDir);

for (const file of files) {
const filePath = path.join(imagesDir, file);
const stats = fs.statSync(filePath);

if (stats.isFile()) {
await client.register(`/images/${file}`, filePath);
}
}
}

async function serve() {
await registerAssets();
client.start({ verbose: true });
}

serve().catch(console.error);
