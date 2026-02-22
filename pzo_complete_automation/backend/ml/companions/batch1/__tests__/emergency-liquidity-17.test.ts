import { EmergencyLiquidity17 } from '../ml/companions/emergency-liquidity-17';
import { describe, expect, it } from '@jest';
import { loadModel } from 'ts-morph';
import * as fs from 'fs';

const model = loadModel({
project: `${__dirname}/../`,
});

describe('EmergencyLiquidity17', () => {
it('should correctly predict emergency liquidity ratio', () => {
const companion = new EmergencyLiquidity17();
const data = JSON.parse(fs.readFileSync(`${__dirname}/data.json`, 'utf8'));

expect(companion.predict(data)).toBeCloseTo(30.0, 2); // Replace with the expected output for a specific test case
});

it('should load model from file', () => {
const modelPath = `${__dirname}/emergency-liquidity-17.mlmodel`;
const companion = new EmergencyLiquidity17({ modelFilePath: modelPath });

expect(companion.model).not.toBeNull();
});
});
