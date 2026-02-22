import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateBadgeDto {
name: string;
description: string;
points: number;
}

async function createBadge(badgeData: CreateBadgeDto) {
return prisma.badge.create({ data: badgeData });
}

interface UpdateBadgeDto {
id: number;
name?: string;
description?: string;
points?: number;
}

async function updateBadge(badgeData: UpdateBadgeDto) {
return prisma.badge.update({ where: { id: badgeData.id }, data: badgeData });
}

interface DeleteBadgeDto {
id: number;
}

async function deleteBadge(badgeData: DeleteBadgeDto) {
return prisma.badge.delete({ where: { id: badgeData.id } });
}

interface AssignBadgeToUserDto {
userId: number;
badgeId: number;
}

async function assignBadgeToUser(userData: AssignBadgeToUserDto) {
return prisma.badge.updateMany({
where: { id: userData.badgeId },
data: { users: { connect: { id: userData.userId } } },
});
}

interface UnassignBadgeFromUserDto {
userId: number;
badgeId: number;
}

async function unassignBadgeFromUser(userData: UnassignBadgeFromUserDto) {
return prisma.badge.updateMany({
where: { id: userData.badgeId },
data: { users: { disconnect: { id: userData.userId } } },
});
}

async function getBadges() {
return prisma.badge.findMany();
}

async function getUserBadges(userId: number) {
return prisma.user.findUnique({ where: { id: userId }, include: { badges: true } });
}

export default {
createBadge,
updateBadge,
deleteBadge,
assignBadgeToUser,
unassignBadgeFromUser,
getBadges,
getUserBadges,
};
