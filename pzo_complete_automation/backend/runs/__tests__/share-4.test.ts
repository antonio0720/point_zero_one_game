import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';
import { runSaga } from 'redux-saga';
import { all, call, put } from 'redux-saga/effects';
import mySaga from '../sagas/mySaga';

describe('Runs lifecycle - share-4', () => {
it('tests share-4 lifecycle', async () => {
const dispatch = jest.fn();
const getState = jest.fn(() => ({ share: { data: [] } }));

runSaga({ dispatch, getState }, mySaga);

// Test your component here and interact with it using fireEvent
const { getByTestId } = render(<MyComponent />);
const myButton = getByTestId('my-button');

fireEvent.click(myButton);

expect(dispatch).toHaveBeenCalledWith({ type: 'SHARE_4/FETCH_INIT' });
// Add more assertions for other actions dispatched in your saga
});
});
