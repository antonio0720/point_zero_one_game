import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlag, Prisma } from '@prisma/client';

@Injectable()
export class FeatureFlagsService {
constructor(private readonly prisma: PrismaService) {}

async createFeatureFlag(data: Prisma.FeatureFlagCreateInput): Promise<FeatureFlag> {
return this.prisma.featureFlag.create({ data });
}

async updateFeatureFlagById(id: string, data: Partial<Prisma.FeatureFlagUpdateInput>): Promise<FeatureFlag | null> {
return this.prisma.featureFlag.update({ where: { id }, data });
}

async deleteFeatureFlagById(id: string): Promise<FeatureFlag | null> {
return this.prisma.featureFlag.delete({ where: { id } });
}

async getFeatureFlagById(id: string): Promise<FeatureFlag | null> {
return this.prisma.featureFlag.findUnique({ where: { id } });
}

async listFeatureFlags(): Promise<FeatureFlag[]> {
return this.prisma.featureFlag.findMany();
}
}
