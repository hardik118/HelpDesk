"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logTimeline = logTimeline;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function logTimeline(ticketId, userId, action) {
    await prisma.timeline.create({
        data: { ticketId, userId, action },
    });
}
