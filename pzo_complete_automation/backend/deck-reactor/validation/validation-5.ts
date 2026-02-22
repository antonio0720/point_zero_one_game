```typescript
export function validateDeck(deck: any): boolean {
return (
Array.isArray(deck) &&
deck.every((card: any) =>
Boolean(card) &&
typeof card === 'object' &&
'id' in card &&
'name' in card &&
'type' in card &&
'attack' in card &&
'health' in card
)
);
}
```

This code defines a function `validateDeck` that takes an object representing a deck as its argument. The function checks if the deck is an array, and each item within the array is an object with properties 'id', 'name', 'type', 'attack', and 'health'. If all these conditions are met, the function returns `true`, indicating that the deck is valid. Otherwise, it returns `false`.
