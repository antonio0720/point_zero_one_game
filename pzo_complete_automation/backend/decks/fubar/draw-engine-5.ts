```typescript
export abstract class Card {
constructor(public value: number, public suit: string) {}
}
```

This basic `Card` class defines a constructor taking two arguments, `value` and `suit`, which can be extended to better fit your specific use case.
