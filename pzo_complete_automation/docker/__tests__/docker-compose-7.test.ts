import { readFileSync } from 'fs';
import * as path from 'path';
import { TestWatcher } from 'jest';
import * as ComposeFile from 'docker-compose-cli/lib/Compile';
import * as chai from 'chai';
const expect = chai.expect;

describe('Docker Compose 7', () => {
let watcher: TestWatcher;

beforeAll(() => {
watcher = jest.createWatchman('.');
});

afterAll(() => {
watcher.close();
});

it('compiles correctly with docker-compose.yml', () => {
const fileContent = readFileSync(path.join(__dirname, 'docker-compose.yml'), 'utf8');
expect(ComposeFile.compileSync(fileContent)).to.not.be.null;
});

it('compiles correctly with docker-compose.yaml', () => {
const fileContent = readFileSync(path.join(__dirname, 'docker-compose.yaml'), 'utf8');
expect(ComposeFile.compileSync(fileContent)).to.not.be.null;
});

// Add more test cases as needed
});
