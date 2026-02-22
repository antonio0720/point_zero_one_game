import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import clientFoundations from './client-foundations';
import { MyTypeSafeApi } from './my-type-safe-api';

describe('Client foundations - type-safe-APIs-11', () => {
it('should correctly initialize', () => {
const TypeSafeApi = clientFoundations.createAPI({
name: 'MyTypeSafeApi',
url: '/api/my',
} as any);

expect(TypeSafeApi).toBeInstanceOf(MyTypeSafeApi);
});

it('should fetch data correctly', async () => {
const TypeSafeApi = clientFoundations.createAPI({
name: 'MyTypeSafeApi',
url: '/api/my',
} as any);

const myTypeSafeApiInstance = new TypeSafeApi();

jest.spyOn(myTypeSafeApiInstance, 'get').mockResolvedValue({ data: [{ id: 1, name: 'Test' }] });

const { getByText } = render(<MyComponent api={myTypeSafeApiInstance} />);

fireEvent.click(getByText('Fetch Data'));

expect(myTypeSafeApiInstance.get).toHaveBeenCalledWith('/api/my');
});
});

const MyComponent: React.FC<{ api: MyTypeSafeApi }> = ({ api }) => {
const fetchData = () => api.get();

return (
<div>
<button onClick={fetchData}>Fetch Data</button>
<ul></ul>
</div>
);
};
