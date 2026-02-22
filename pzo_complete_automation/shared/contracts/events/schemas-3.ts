// event.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getEvents = async (): Promise<Event[]> => {
return await prisma.event.findMany({});
};

export const getEventById = async (id: string): Promise<Event | null> => {
return await prisma.event.findOne({ where: { id } });
};

export const createEvent = async (data: Omit<Event, 'id'>): Promise<Event> => {
return await prisma.event.create({ data });
};

export const updateEvent = async (id: string, data: Partial<Event>): Promise<Event | null> => {
return await prisma.event.update({ where: { id }, data });
};

export const deleteEvent = async (id: string): Promise<Event | null> => {
return await prisma.event.delete({ where: { id } });
};
