```typescript
import { SeededRandom } from 'tiny-seed';
import { ReplayRecord } from './replay-record';

class DeterministicReplayer {
private seed: number;
private random = new SeededRandom(this.seed);

constructor(seed: number) {
this.seed = seed;
}

replay(fn: Function, record: ReplayRecord): any {
const { input, state } = record;
this.random.setSeed(state);

// Reset the random number generator to the initial state before executing the function
const originalRandom = globalThis.Math.random;
globalThis.Math.random = () => this.random();

let result = fn(input);

// Restore the original random number generator
globalThis.Math.random = originalRandom;

return result;
}
}
```

In this example, the `DeterministicReplayer` class takes a seed and uses it to create a deterministic random number generator instance with the `tiny-seed` library. The `replay()` method takes a function (`fn`) and a replay record containing an input and state. It sets the global Math.random function to the deterministic one created earlier, calls the given function with the provided input, restores the original random number generator, and returns the result.

To use this code, you would need to install the `tiny-seed` library first:

```bash
npm install tiny-seed
```

And then create replay records for your functions by saving their initial state before calling them:

```typescript
const myFunction = (input: any) => {
// some code here that depends on Math.random()
};

const record1 = new ReplayRecord(myFunction, { state: this.random.getSeed(), input });
const result1 = new DeterministicReplayer(record1.state).replay(myFunction, record1);
```

Later, you can replay the function with the recorded state:

```typescript
const result2 = new DeterministicReplayer(record1.state).replay(myFunction, record1);
```
