import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function logTimeline(ticketId: string, userId: string, action: string) {
  await prisma.timeline.create({
    data: { ticketId, userId, action },
  });
}
