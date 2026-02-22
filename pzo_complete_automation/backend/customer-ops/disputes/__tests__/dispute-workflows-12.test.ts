import { DisputeService } from '../dispute.service';
import { Dispute, DisputeStatus } from '../../../domain/disputes/dispute.model';
import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DisputeWorkflowService } from './dispute-workflow.service';
import { DisputeWorkflow, DisputeOutcome } from '../../../domain/disputes/dispute-workflows';

describe('DisputeWorkflowService', () => {
let service: DisputeWorkflowService;
let disputeService: jasmine.SpyObj<DisputeService>;
let httpMock: HttpTestingController;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [HttpClientTestingModule],
providers: [
DisputeWorkflowService,
{ provide: DisputeService, useValue: jasmine.createSpyObj('DisputeService', ['processDispute']) },
],
});

service = TestBed.inject(DisputeWorkflowService);
disputeService = TestBed.inject(DisputeService) as jasmine.SpyObj<DisputeService>;
httpMock = TestBed.inject(HttpTestingController);
});

it('should handle dispute workflow 12', () => {
const dispute: Dispute = { id: '1', status: DisputeStatus.OPEN };
const disputeWorkflow: DisputeWorkflow = {
id: '12',
name: 'Dispute Workflow 12',
disputes: [dispute],
outcomes: [DisputeOutcome.WIN],
};

disputeService.processDispute.and.returnValue(of(null));

service.handleWorkflow(disputeWorkflow).subscribe(() => {
expect(disputeService.processDispute).toHaveBeenCalledWith(dispute, DisputeOutcome.WIN);
httpMock.verify();
});
});

it('should handle error when processing dispute', () => {
const dispute: Dispute = { id: '1', status: DisputeStatus.OPEN };
const disputeWorkflow: DisputeWorkflow = {
id: '12',
name: 'Dispute Workflow 12',
disputes: [dispute],
outcomes: [DisputeOutcome.WIN],
};

disputeService.processDispute.and.returnValue(throwError({ error: 'Some Error' }));

service.handleWorkflow(disputeWorkflow).subscribe(() => {
fail('Expected an error to be thrown');
}, (error) => {
expect(error.message).toEqual('Some Error');
httpMock.verify();
});
});
});
