import { describe, it, expect } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

describe('Cards are draggable to play zone', () => {
  it('Drag card from hand, drop on asset slot, card plays, energy deducts', async () => {
    const { getByText, queryByText } = render(<YourComponent />);
    const cardInHand = getByText(/Card in Hand/);
    const assetSlot = getByText(/Asset Slot/);

    fireEvent.dragStart(cardInHand, { dataTransfer: { items: [{ type: 'card', id: 1 }] } });
    fireEvent.dragOver(assetSlot);
    fireEvent.drop(assetSlot);

    await waitFor(() => expect(queryByText(/Card played!/)).toBeInTheDocument());
    await waitFor(() => expect(queryByText(/Energy: 0/)).toBeInTheDocument());
  });
});
