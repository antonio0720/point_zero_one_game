import { signAction } from '../../src/backend/integrity/signed-actions';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../src/constants';
import { NextApiRequest, NextApiResponse } from 'next';
import faker from '@faker-js/faker';

describe('signed-actions-4', () => {
const request: NextApiRequest = {
body: JSON.stringify({ data: faker.datatype.json() }),
headers: {
'Content-Type': 'application/json',
},
} as any;

const response: NextApiResponse = {} as any;

it('should sign an action correctly', async () => {
// Arrange
const dataToSign = faker.datatype.json();

// Act
const signedAction = await signAction(request, dataToSign);

// Assert
expect(jwt.verify(signedAction, JWT_SECRET)).toEqual({ data: dataToSign });
});

it('should return a 401 error when the signature is invalid', async () => {
// Arrange
const incorrectJwtSecret = 'incorrect-secret';
const dataToSign = faker.datatype.json();
const signedAction = jwt.sign({ data: dataToSign }, incorrectJwtSecret);

// Act & Assert
await expect(signAction(request, signedAction)).rejects.toThrow('Unauthorized');
});
});
