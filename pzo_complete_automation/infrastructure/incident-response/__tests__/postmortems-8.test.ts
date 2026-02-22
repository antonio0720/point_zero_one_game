import { Postmortems8 } from '../../incident-response/postmortems-8';
import { expect } from 'chai';
import sinon from 'sinon';
import 'chai-sinon';

describe('Postmortems8', () => {
let postmortems8Instance;

beforeEach(() => {
postmortems8Instance = new Postmortems8();
});

it('should return correct incident report', () => {
// Arrange
const expectedReport = { /* some expected structure */ };

sinon.stub(postmortems8Instance, 'generateIncidentReport').returns(expectedReport);

// Act
const result = postmortems8Instance.getPostmortemReport();

// Assert
expect(result).to.deep.equal(expectedReport);
});

it('should throw an error when generating incident report', () => {
// Arrange
sinon.stub(postmortems8Instance, 'generateIncidentReport').throws(new Error('Mock Error'));

// Act and Assert
expect(postmortems8Instance.getPostmortemReport).to.throw('Mock Error');
});
});
