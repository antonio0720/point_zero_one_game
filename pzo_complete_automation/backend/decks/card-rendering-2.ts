```typescript
import React from 'react';
import PropTypes from 'prop-types';

interface Props {
id: string;
question: string;
answer: string;
}

const DeckCard: React.FC<Props> = ({ id, question, answer }) => (
<div className="deck-card">
<h3>{question}</h3>
<p>{answer}</p>
</div>
);

DeckCard.propTypes = {
id: PropTypes.string.isRequired,
question: PropTypes.string.isRequired,
answer: PropTypes.string.isRequired,
};

export default DeckCard;
```

You can use this component in your deck system like so:

```typescript
import React from 'react';
import DeckCard from './card-rendering-2';

const MyDeck: React.FC = () => (
<div className="my-deck">
<DeckCard id="1" question="What is TypeScript?" answer="TypeScript is a typed superset of JavaScript that compiles to plain JS." />
<DeckCard id="2" question="What does 'FC' stand for in the DeckCard component declaration?" answer="'FC' stands for functional component, a type defined by React." />
</div>
);

export default MyDeck;
```
