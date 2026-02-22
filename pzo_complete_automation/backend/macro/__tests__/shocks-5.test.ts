import { render, screen } from '@testing-library/react';
import { ShocksFive } from '../shocks-5';
import { MacroProvider } from '../../../contexts/macro-provider';

describe('Shocks Five', () => {
it('renders correctly', () => {
render(
<MacroProvider>
<ShocksFive />
</MacroProvider>
);

// Add assertions for specific elements, text or behavior here.
});
});
