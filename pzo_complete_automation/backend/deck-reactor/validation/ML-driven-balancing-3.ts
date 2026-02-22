const modelUrl = '/path/to/your-trained-ml-model.json';
const deck = new Deck(modelUrl);
deck.addCard({ name: 'Card1', cost: 2, power: 4 });
deck.addCard({ name: 'Card2', cost: 3, power: 5 });
// ... add more cards
const balancedDeck = deck.balanceDeck();
```

After training your model, save it as a JSON file (`.json` extension) containing the trained weights and architecture, and then use the provided code example by updating `modelUrl` with the path to your saved model.
