import React from 'react';
import { render } from '@testing-library/react';
import { DeckProvider } from '../../providers/DeckProvider';
import { Card } from '../../components/Card';
import userEvent from '@testing-library/user-event';

describe('Deck systems - card-rendering-10', () => {
const deck = {
id: 'fubar',
title: 'Test Deck',
cards: [
{ id: 'card1', question: 'Question 1', answer: 'Answer 1' },
{ id: 'card2', question: 'Question 2', answer: 'Answer 2' },
// Add more cards as needed
],
};

it('renders the deck correctly with all cards visible', () => {
const { getByText } = render(
<DeckProvider initialDeck={deck}>
<Card />
</DeckProvider>
);

// Add assertions to check if each card is rendered correctly
});

it('renders the deck correctly with only one card visible', () => {
const { getByText, queryByText } = render(
<DeckProvider initialDeck={deck}>
<Card showOneCard />
</DeckProvider>
);

// Add assertions to check if only one card is visible and the others are hidden
});

it('allows navigating through cards', () => {
const { getByText, queryByText } = render(
<DeckProvider initialDeck={deck}>
<Card />
</DeckProvider>
);

// Add user event actions to navigate through the cards and assertions to check the current card
});
});
