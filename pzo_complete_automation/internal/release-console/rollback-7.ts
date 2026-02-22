Here is a TypeScript file named `rollback-7.ts` that implements a rollback function for versions 6 to 4. The code uses an array to store the version history and a function `rollback()` to handle the rollbacks.

```typescript
export type Version = number;
const MAX_VERSION: Version = 7;
const MIN_VERSION: Version = 4;
const versions: Version[] = [6, 7];

function rollback(): void {
if (versions[0] <= MIN_VERSION) {
throw new Error("Cannot roll back further than version 4");
}

const currentVersionIndex = versions.findIndex((version) => version === MAX_VERSION);
versions[currentVersionIndex] = versions[currentVersionIndex - 1];
}
```

This code creates a `rollback()` function that decrements the current version number when called. If the rollback would go below the minimum supported version (4), it throws an error.
