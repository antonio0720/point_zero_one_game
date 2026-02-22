import { act, renderHook } from '@testing-library/react-hooks';
import { Inflation } from '../../macro/inflation';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const server = setupServer(
rest.get('/api/inflation', (req, res, ctx) => {
return res(ctx.json({ rate: 2.5 }));
})
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());

describe('Inflation', () => {
it('should return the inflation rate', async () => {
const { result } = renderHook(() => Inflation());
await act(async () => {});
expect(result.current).toEqual(2.5);
});
});
