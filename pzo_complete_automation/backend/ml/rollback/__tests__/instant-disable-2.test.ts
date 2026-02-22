1. Enabling the kill switch when called with true.
2. Not enabling the kill switch when called with false.
3. Handling errors from the killSwitch function.

Each test case uses sinon to stub the `killSwitch` global, simulate its behavior, and assert that it was called (or not) as expected.
