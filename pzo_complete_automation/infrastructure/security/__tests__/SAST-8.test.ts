Here's a basic example of a TypeScript test file for the security hardening rule SAST-8 using Jest as the testing framework. This example does not include actual test cases but sets up the structure for creating them.

```typescript
import { readFileSync } from 'fs';
import * as path from 'path';
import * as fg from 'fast-glob';
import * as sast from '@sonar/planning-client';
import { SAST8Rule } from './SAST8Rule';

describe('SAST-8 Rule Test', () => {
let rule: SAST8Rule;

beforeEach(() => {
rule = new SAST8Rule();
});

it('should pass for a valid file with no issues', async () => {
// Add your test case here
});

it('should fail for a file with a violation of the SAST-8 rule', async () => {
// Add your test case here
});
});
```

To run the tests, you would need to implement the `SAST8Rule` class and provide the actual test cases. In addition, you should have a function to analyze files for potential violations and implement the necessary functions to read files from disk using fast-glob and fs modules. The actual implementation details will depend on your specific project requirements and the filesystem structure.
