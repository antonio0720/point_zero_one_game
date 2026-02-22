import * as path from 'path';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import { test, expect } from '@jest/globals';
import { Composefile } from 'compose-file';

const dockerComposeFile = path.join(__dirname, '..', 'docker-compose.yml');
const dockerComposeContent = readFileSync(dockerComposeFile, 'utf8');

describe('Local dev substrate - docker-compose-2', () => {
let compose;

beforeAll(() => {
compose = new Composefile(dockerComposeContent);
});

test('Check Docker Compose file exists', () => {
expect(fs.existsSync(dockerComposeFile)).toBe(true);
});

test('Check Composefile content', () => {
expect(compose.services).toEqual({
// Your services definition here
});
});

// Add more tests as needed to test the functionality of your Docker Compose setup
});
