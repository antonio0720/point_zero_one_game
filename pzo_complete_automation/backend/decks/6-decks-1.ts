const decks: Deck[] = Array(6).fill(new Deck());
decks[0].shuffle(); // Shuffle the first deck
const card1 = decks[0].drawCard(); // Draw a card from the shuffled deck
```
