import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, FindConditions } from 'typeorm';
import { ApprovalWorkflowEntity } from './approval-workflow.entity';
import { UserEntity } from '../user/user.entity';
import { ApprovalStatus } from './enums/approval-status.enum';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';
import { Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../user/users.service';

@Injectable()
export class ApprovalWorkflowsService {
constructor(
@InjectRepository(ApprovalWorkflowEntity)
private readonly approvalWorkflowRepository: Repository<ApprovalWorkflowEntity>,
private readonly userService: UsersService,
@Inject(forwardRef(() => EntityManager))
private readonly entityManager: EntityManager,
) {}

async create(createApprovalWorkflowDto: CreateApprovalWorkflowDto): Promise<ApprovalWorkflowEntity> {
const { creatorId, approvers } = createApprovalWorkflowDto;

const creator = await this.userService.findOne(creatorId);
if (!creator) throw new Error('Creator not found');

const approvalWorkflow = this.approvalWorkflowRepository.create({ ...createApprovalWorkflowDto, status: ApprovalStatus.PENDING });
await this.entityManager.save(approvalWorkflow);

approvers.forEach(async (approverId) => {
const approver = await this.userService.findOne(approverId);
if (!approver) throw new Error('Approver not found');

approvalWorkflow.approvers.push(approver);
});

return this.entityManager.save(approvalWorkflow);
}

async findAll(): Promise<ApprovalWorkflowEntity[]> {
return this.approvalWorkflowRepository.find();
}

async findOne(id: number): Promise<ApprovalWorkflowEntity> {
const approvalWorkflow = await this.approvalWorkflowRepository.findOne({ where: { id }, relations: ['creator', 'approvers'] });
if (!approvalWorkflow) throw new Error('Approval workflow not found');
return approvalWorkflow;
}

async update(id: number, updateApprovalWorkflowDto: UpdateApprovalWorkflowDto): Promise<ApprovalWorkflowEntity> {
const approvalWorkflow = await this.findOne(id);

Object.assign(approvalWorkflow, updateApprovalWorkflowDto);
return this.entityManager.save(approvalWorkflow);
}

async remove(id: number): Promise<void> {
const approvalWorkflow = await this.findOne(id);
await this.entityManager.remove(approvalWorkflow);
}

async approve(id: number, userId: number): Promise<ApprovalWorkflowEntity> {
const approvalWorkflow = await this.findOne(id);

if (approvalWorkflow.status !== ApprovalStatus.PENDING) throw new Error('Approval workflow is not pending');

const approver = await this.userService.findOne(userId);
if (!approver || !approvalWorkflow.approvers.includes(approver)) throw new Error('User or approval workflow not found');

const approvedBy = { id: userId, name: approver.name };
approvalWorkflow.status = ApprovalStatus.APPROVED;
approvalWorkflow.approvedBy = [approvedBy];
return this.entityManager.save(approvalWorkflow);
}

async reject(id: number, userId: number): Promise<ApprovalWorkflowEntity> {
const approvalWorkflow = await this.findOne(id);

if (approvalWorkflow.status !== ApprovalStatus.PENDING) throw new Error('Approval workflow is not pending');

const approver = await this.userService.findOne(userId);
if (!approver || !approvalWorkflow.approvers.includes(approver)) throw new Error('User or approval workflow not found');

const rejectedBy = { id: userId, name: approver.name };
approvalWorkflow.status = ApprovalStatus.REJECTED;
approvalWorkflow.rejectedBy = [rejectedBy];
return this.entityManager.save(approvalWorkflow);
}

async findPending(): Promise<ApprovalWorkflowEntity[]> {
const pendingApprovalWorkflows = await this.approvalWorkflowRepository
.createQueryBuilder('approval_workflow')
.where('status = :status', { status: ApprovalStatus.PENDING })
.leftJoinAndSelect('approval_workflow.creator', 'creator')
.leftJoinAndSelect('approval_workflow.approvers', 'approvers')
.getMany();
return pendingApprovalWorkflows;
}
}

export class CreateApprovalWorkflowDto extends OmitType(ApprovalWorkflowEntity, ['id', 'status', 'creator', 'approvers']) {
@ApiProperty()
creatorId: number;

@ApiProperty({ isArray: true })
approvers: number[];
}

export class UpdateApprovalWorkflowDto extends OmitType(ApprovalWorkflowEntity, ['id', 'creator', 'approvers']) {}
