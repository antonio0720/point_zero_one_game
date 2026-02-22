```typescript
export function verifyArrayIntegrity<T>(array: T[], expectedLength: number): boolean {
if (array.length !== expectedLength) return false;

const seenValues: Set<T> = new Set();
for (const value of array) {
if (!seenValues.add(value)) return false;
}

return true;
}
```

The function takes an array `array` and an expected length `expectedLength` as input arguments. It returns a boolean value indicating whether the array is consistent (i.e., its length matches the expected length, and all its elements are unique).

This function uses a Set to ensure that the array only contains unique elements and checks if adding each element to the Set results in a `true` return value from the `add()` method. If an element has already been added to the Set, it means that the array contains duplicate elements, and the function returns `false`.

The function also checks if the length of the array matches the expectedLength. In case the lengths are not equal, the function returns `false`, indicating that the integrity of the array is compromised.
