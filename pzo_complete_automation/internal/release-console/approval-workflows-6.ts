import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalWorkflow } from './approval-workflow.entity';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';

@Injectable()
export class ApprovalWorkflowService {
constructor(
@InjectRepository(ApprovalWorkflow)
private approvalWorkflowRepository: Repository<ApprovalWorkflow>,
) {}

async create(createApprovalWorkflowDto: CreateApprovalWorkflowDto) {
return this.approvalWorkflowRepository.save(createApprovalWorkflowDto);
}

findAll() {
return this.approvalWorkflowRepository.find();
}

findOne(id: number) {
return this.approvalWorkflowRepository.findOneBy({ id });
}

update(id: number, updateApprovalWorkflowDto: UpdateApprovalWorkflowDto) {
return this.approvalWorkflowRepository.update(id, updateApprovalWorkflowDto);
}

remove(id: number) {
return this.approvalWorkflowRepository.delete(id);
}
}
