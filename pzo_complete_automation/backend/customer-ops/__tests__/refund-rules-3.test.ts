import { RefundRulesService } from '../services/refund-rules.service';
import { RefundRule3 } from '../models/refund-rule-3.model';
import { Injectable, forwardRef, NestJsSpecProvider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

describe('RefundRulesService', () => {
let service: RefundRulesService;
let refundRule3Model: Model<RefundRule3>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
RefundRulesService,
{
provide: getModelToken('RefundRule3'),
useValue: {} as Model<RefundRule3>,
},
],
}).compile();

service = module.get<RefundRulesService>(RefundRulesService);
refundRule3Model = module.get(getModelToken('RefundRule3'));
});

describe('create', () => {
it('should create a new refund rule 3', async () => {
// your test case implementation
});
});

describe('findOne', () => {
it('should find a refund rule 3 by id', async () => {
// your test case implementation
});
});

describe('update', () => {
it('should update a refund rule 3', async () => {
// your test case implementation
});
});

describe('remove', () => {
it('should remove a refund rule 3', async () => {
// your test case implementation
});
});
});
