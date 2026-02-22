import { prisma } from "../../../../generated/prisma-client";
import { Context } from "graphql-yoga";

const createSettlement = async (obj, args, ctx: Context) => {
const settlement = await prisma.createSettlement({
userId: args.userId,
totalAmount: args.totalAmount,
status: args.status,
createdAt: new Date(),
updatedAt: new Date()
});

return settlement;
};

export default createSettlement;
