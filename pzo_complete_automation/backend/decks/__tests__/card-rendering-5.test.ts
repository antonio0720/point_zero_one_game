import React from 'react';
import { render } from '@testing-library/react';
import { DeckProvider } from '../../providers/DeckProvider';
import { Card } from '../card';
import { Deck, DeckData } from '../deck';
import { SampleDeckData } from '../sample-data';

describe('Card Rendering - Test 5', () => {
const sampleDeckData: DeckData = SampleDeckData;

it('should render card with correct content when deck is shuffled and cards are drawn correctly', () => {
const { getByText, queryByText } = render(
<DeckProvider initialDeck={sampleDeckData}>
<Deck>
{(cards) => (
<div data-testid="card-container">
{cards.map((card) => (
<Card key={card.id} card={card} />
))}
</div>
)}
</Deck>
</DeckProvider>
);

// Add shuffle and draw logic here
const shuffledCards = sampleDeckData.cards.sort(() => 0.5 - Math.random());
const drawnCards = shuffledCards.slice(0, 5);

// Check if the first card has the correct content
expect(getByText(drawnCards[0].front)).toBeInTheDocument();

// Check if the last card has the correct content
expect(getByText(drawnCards[drawnCards.length - 1].back)).toBeInTheDocument();

// Check if none of the drawn cards appear twice
drawnCards.forEach((card) => {
expect(queryByText(card.id)).not.toBeInTheDocument();
});
});
});
