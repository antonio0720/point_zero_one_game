import { MisclickGuard15 } from '../misclick-guard-15';
import { expect } from 'expect';
import { SpyObject } from 'ts-mockito';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

describe('MisclickGuard15', () => {
let misclickGuard15: MisclickGuard15;
let httpClient: SpyObject<HttpClient>;

beforeEach(() => {
httpClient = SpyObject.create(HttpClient);
misclickGuard15 = new MisclickGuard15(httpClient as any);
});

it('should return true when correct click', async () => {
const response = { data: true };
(httpClient as any).post.and.returnValue(Promise.resolve(response));

const result = await misclickGuard15.checkCorrectClick();
expect(result).toBeTruthy();
});

it('should return false when incorrect click', async () => {
const response: HttpErrorResponse = { name: 'HttpErrorResponse', status: 404 };
(httpClient as any).post.and.returnValue(Promise.resolve(response));

const result = await misclickGuard15.checkCorrectClick();
expect(result).toBeFalsy();
});
});
