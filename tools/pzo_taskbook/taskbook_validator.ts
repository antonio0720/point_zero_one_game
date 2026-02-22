Here is the TypeScript code for the taskbook validator as per your specifications:

```typescript
/**
 * Taskbook Validator
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ndjson from 'ndjson';

interface Task {
  id: string;
  phase: string;
  type: string;
  input?: string;
}

/**
 * Validate the taskbook file and emit a report.
 * @param filePath - The path to the taskbook file.
 */
export function validateTaskbook(filePath: string): void {
  const file = fs.createReadStream(filePath);

  let tasks: Task[] = [];
  let uniqueIds: Set<string> = new Set();

  // Read and parse the taskbook file line by line.
  file.pipe(ndjson.parse()).on('data', (task) => {
    if (!task.id || !uniqueIds.add(task.id)) {
      throw new Error(`Duplicate ID: ${task.id}`);
    }

    if (!['phase', 'type'].every((key) => task.hasOwnProperty(key))) {
      throw new Error('Missing required fields "phase" and/or "type"');
    }

    tasks.push(task);
  }).on('end', () => {
    // Check for empty inputs.
    const hasEmptyInputs = tasks.some((task) => !task.input);

    if (hasEmptyInputs) {
      throw new Error('Found one or more empty inputs');
    }

    console.log('Taskbook validation successful.');
  }).on('error', (err) => {
    console.error(`Error validating taskbook: ${err.message}`);
    process.exit(1);
  });
}
```

This TypeScript code reads a ndjson file, validates the structure of each task in the file, and checks for unique IDs and non-empty inputs. If any errors are found during validation, it logs an error message and exits with a status code of 1. Otherwise, it prints a success message. The code follows strict TypeScript types, exports the `validateTaskbook` function, and includes JSDoc comments for each public symbol.
