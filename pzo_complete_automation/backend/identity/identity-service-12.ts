import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserWhereUniqueInput } from '../prisma/generated/client/prisma-client';

@Injectable()
export class IdentityService {
constructor(private readonly prisma: PrismaService) {}

async getUserById(id: string): Promise<any> {
return this.prisma.user.findUnique({ where: { id } });
}

async createUser(input: any): Promise<any> {
return this.prisma.user.create({ data: input });
}

async updateUser(id: string, input: any): Promise<any> {
const user = await this.getUserById(id);

if (!user) {
throw new NotFoundException('User not found');
}

return this.prisma.user.update({ data: input, where: { id } });
}

async deleteUser(id: string): Promise<any> {
const user = await this.getUserById(id);

if (!user) {
throw new NotFoundException('User not found');
}

return this.prisma.user.delete({ where: { id } });
}
}
