import { expect } from 'expect';
import * as path from 'path';
import * as fs from 'fs';
import * as macros from '@my-project/macros';

describe('inflation-8', () => {
it('should return the correct result', () => {
const input = `
10
2 3 0 5 4
`;

const result = macros.inflation8(input);

fs.readFileSync(path.join(__dirname, 'expected_output.txt'), 'utf-8')
.split('\n')
.forEach((line, i) => {
expect(result[i]).toEqual(line);
});
});
});
