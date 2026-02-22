import React from 'react';
import { render, screen } from '@testing-library/react';
import { OBSIntegration } from '../../components/OBSIntegration';
import userEvent from '@testing-library/user-event';

describe('OBS Integration', () => {
it('should start and stop OBS capture when buttons are clicked', async () => {
const mockStartCapture = jest.fn();
const mockStopCapture = jest.fn();

render(<OBSIntegration startCapture={mockStartCapture} stopCapture={mockStopCapture} />);

const startButton = screen.getByTestId('start-button');
const stopButton = screen.getByTestId('stop-button');

expect(startButton).toBeInTheDocument();
expect(stopButton).not.toBeInTheDocument();

userEvent.click(startButton);
expect(mockStartCapture).toHaveBeenCalledTimes(1);
expect(screen.getByTestId('stop-button')).toBeInTheDocument();

userEvent.click(stopButton);
expect(mockStopCapture).toHaveBeenCalledTimes(1);
expect(screen.queryByTestId('stop-button')).not.toBeInTheDocument();
});
});
