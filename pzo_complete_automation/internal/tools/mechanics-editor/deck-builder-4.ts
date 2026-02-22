import * as React from 'react';
import { Card } from './Card';
import { Deck } from './Deck';
import { DeckProvider } from './DeckContext';

export const DeckBuilder4 = () => {
return (
<DeckProvider>
<div className="deck-builder">
<div className="deck-builder__header">Deck Builder 4</div>
<Deck className="deck">
<Card id={1} />
<Card id={2} />
<Card id={3} />
<Card id={4} />
<Card id={5} />
<Card id={6} />
<Card id={7} />
</Deck>
</div>
</DeckProvider>
);
};
