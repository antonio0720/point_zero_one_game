import { RefundRulesService } from '../refund-rules.service';
import { RefundRule13DTO, RefundResponse } from '../dto/refund-response.dto';
import { createRefundRule13DTO } from '../mocks/refund-rule-13.mock';

describe('RefundRulesService', () => {
let service: RefundRulesService;

beforeEach(() => {
service = new RefundRulesService();
});

it('should handle refund rule 13 correctly', () => {
const refundRule13DTO = createRefundRule13DTO();
const expectedResponse: RefundResponse = {
// Example of expected response structure
};

expect(service.handleRefundRule(refundRule13DTO)).toEqual(expectedResponse);
});
});
