import { validate } from './validation-pipeline';
import { ValidationError } from '../errors/ValidationError';
import { createMockContext, MockContext } from 'jest-mock-aws-lambda';
import { MyInputType } from '../../types/MyInputType';

describe('validationPipeline', () => {
let mockContext: MockContext;

beforeEach(() => {
mockContext = createMockContext();
});

it('should pass if input is valid', () => {
const validInput: MyInputType = {
// valid input values
};

expect(validate(validInput, mockContext)).resolves.toBeUndefined();
});

it('should throw ValidationError if input is invalid', () => {
const invalidInput: MyInputType = {
// invalid input values
};

expect(validate(invalidInput, mockContext)).rejects.toThrow(ValidationError);
});
});
