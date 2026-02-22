import { test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { readFileSync } from 'fs';
import { generateDependencyGraph } from '../src/dependency-graph-5';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('generates dependency graph for monorepo', () => {
const inputFile = path.join(__dirname, 'input', 'package.json');
const expectedOutputFile = path.join(__dirname, 'expected-output', 'dependency-graph-5.txt');

const inputJson = JSON.parse(readFileSync(inputFile, 'utf8'));
const outputGraph = generateDependencyGraph(inputJson);

const expectedOutput = readFileSync(expectedOutputFile, 'utf8').toString();
expect(outputGraph).toEqual(expectedOutput);
});
