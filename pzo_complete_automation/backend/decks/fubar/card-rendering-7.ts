import React, { useState } from 'react';
import CardComponent from './card-component';

const Deck = () => {
const [cards, setCards] = useState<number[]>(Array(52).fill(null));
const [flippedId, setFlippedId] = useState<number | null>(null);

const handleCardFlip = (id: number) => {
if (!flippedId || flippedId === id) return;

const newCards = [...cards];
const cardIndex1 = newCards.indexOf(flippedId);
const cardIndex2 = newCards.indexOf(id);

newCards[cardIndex1] = null;
newCards[cardIndex2] = null;

setFlippedId(null);
setCards(newCards);
};

return (
<div className="deck">
{cards.map((_, index) => (
<CardComponent key={index} id={index} isFlipped={!!flippedId && flippedId === index} onFlip={handleCardFlip} />
))}
</div>
);
};

export default Deck;
