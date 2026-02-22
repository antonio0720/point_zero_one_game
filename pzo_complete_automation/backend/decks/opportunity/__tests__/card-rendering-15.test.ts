import React from 'react';
import { render } from '@testing-library/react';
import { DeckProvider } from '../../contexts/DeckContext';
import { Card } from '.';
import { Deck, Question } from '../models';

describe('Card Rendering', () => {
const deck: Deck = {
id: '123',
title: 'Test Deck',
questions: [
{
id: 'q1',
content: 'What is the capital of France?',
answer: 'Paris',
points: 5,
},
// Add more questions as needed
],
};

it('renders a card with question and answer', () => {
const { getByText } = render(
<DeckProvider deck={deck}>
<Card />
</DeckProvider>
);

// Add assertions for the rendered card here
});

it('renders a card with correct points when hovered', () => {
const { getByText } = render(
<DeckProvider deck={deck}>
<Card />
</DeckProvider>
);

// Add assertions for the hover state of the card here
});

it('renders a card with correct answer when clicked', () => {
const { getByText } = render(
<DeckProvider deck={deck}>
<Card />
</DeckProvider>
);

// Add assertions for the revealed answer of the card here
});
});
