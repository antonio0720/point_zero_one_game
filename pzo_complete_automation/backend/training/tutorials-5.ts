import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, getConnection } from 'typeorm';
import { OnboardingStepEntity } from './onboarding-step.entity';
import { CreateOnboardingStepDto } from './dto/create-onboarding-step.dto';
import { UpdateOnboardingStepDto } from './dto/update-onboarding-step.dto';

@Injectable()
export class OnboardingService {
constructor(
@InjectRepository(OnboardingStepEntity)
private onboardingStepRepository: Repository<OnboardingStepEntity>,
) {}

async createOnboardingStep(createOnboardingStepDto: CreateOnboardingStepDto): Promise<OnboardingStepEntity> {
return this.onboardingStepRepository.save(createOnboardingStepDto);
}

findAll(): Promise<OnboardingStepEntity[]> {
return this.onboardingStepRepository.find();
}

async updateOnboardingStep(id: number, updateOnboardingStepDto: UpdateOnboardingStepDto): Promise<OnboardingStepEntity> {
const onboardingStep = await this.onboardingStepRepository.findOne(id);
if (!onboardingStep) throw new Error('Onboarding step not found');
Object.assign(onboardingStep, updateOnboardingStepDto);
return this.onboardingStepRepository.save(onboardingStep);
}

async deleteOnboardingStep(id: number): Promise<void> {
const onboardingStep = await this.onboardingStepRepository.findOne(id);
if (!onboardingStep) throw new Error('Onboarding step not found');
return this.onboardingStepRepository.remove(onboardingStep);
}
}

import { Injectable, forwardRef } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { ModelType } from '@typegoose/typegoose/lib/types';
import { Prop, schema, Schema, plural } from '@typegoose/typegoose';

@Schema()
export class OnboardingStep extends ModelType {
@Prop({ required: true })
title: string;

@Prop({ required: true })
description: string;

@Prop({ required: true, enum: ['1', '2', '3', '4', '5'] })
order: number;
}
