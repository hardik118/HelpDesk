"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const sla_1 = require("../utils/sla");
const rateLimit_1 = require("../middleware/rateLimit");
const idempotency_1 = require("../middleware/idempotency");
const timeline_1 = require("../utils/timeline");
exports.ticketRouter = (0, express_1.Router)();
exports.ticketRouter.use(auth_1.auth, rateLimit_1.rateLimit);
// Create Ticket (USER)
exports.ticketRouter.post("/", auth_1.auth, (0, auth_1.requireRole)(["USER"]), idempotency_1.idempotency, async (req, res) => {
    try {
        const { title, description, priority } = req.body;
        if (!title || !description) {
            return res.status(400).json({ error: { code: "FIELD_REQUIRED", message: "Title and description required" } });
        }
        const slaDeadline = (0, sla_1.getSlaDue)(priority);
        const ticket = await prisma_1.prisma.ticket.create({
            data: {
                title,
                description,
                slaDeadline,
                createdById: req.user.id,
            },
        });
        await (0, timeline_1.logTimeline)(ticket.id, req.user.id, "Created ticket");
        res.json(ticket);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "SERVER_ERROR" } });
    }
});
// List Tickets (with search, pagination)
exports.ticketRouter.get("/", auth_1.auth, async (req, res) => {
    try {
        const { limit = 10, offset = 0, q } = req.query;
        const where = {};
        if (q) {
            where.OR = [
                { title: { contains: String(q), mode: "insensitive" } },
                { description: { contains: String(q), mode: "insensitive" } },
                {
                    comments: {
                        some: { content: { contains: String(q), mode: "insensitive" } },
                    },
                },
            ];
        }
        // Role-based filter
        if (req.user.role === "USER")
            where.createdById = req.user.id;
        else if (req.user.role === "AGENT")
            where.assignedToId = req.user.id;
        const tickets = await prisma_1.prisma.ticket.findMany({
            where,
            skip: Number(offset),
            take: Number(limit),
            orderBy: { createdAt: "desc" },
            include: { comments: true },
        });
        res.json({ items: tickets, next_offset: Number(offset) + tickets.length });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "SERVER_ERROR" } });
    }
});
// Get single ticket with comments
exports.ticketRouter.get("/:id", auth_1.auth, async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await prisma_1.prisma.ticket.findUnique({
            where: { id },
            include: { comments: { include: { author: true } } },
        });
        if (!ticket)
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
        // Role check
        if (req.user.role === "USER" && ticket.createdById !== req.user.id)
            return res.status(403).json({ error: { code: "FORBIDDEN" } });
        if (req.user.role === "AGENT" && ticket.assignedToId !== req.user.id)
            return res.status(403).json({ error: { code: "FORBIDDEN" } });
        res.json(ticket);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "SERVER_ERROR" } });
    }
});
// Update ticket (optimistic locking)
exports.ticketRouter.patch("/:id", auth_1.auth, (0, auth_1.requireRole)(["USER", "AGENT", "ADMIN"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, version } = req.body;
        if (!version) {
            return res.status(400).json({ error: { code: "FIELD_REQUIRED", message: "Version required" } });
        }
        const ticket = await prisma_1.prisma.ticket.findUnique({ where: { id } });
        if (!ticket)
            return res.status(404).json({ error: { code: "NOT_FOUND" } });
        // Check optimistic locking
        if (ticket.version !== version)
            return res.status(409).json({ error: { code: "STALE_UPDATE", message: "Ticket has been updated already" } });
        // Role-based update check
        if (req.user.role === "USER" && ticket.createdById !== req.user.id)
            return res.status(403).json({ error: { code: "FORBIDDEN" } });
        if (req.user.role === "AGENT" && ticket.assignedToId !== req.user.id)
            return res.status(403).json({ error: { code: "FORBIDDEN" } });
        const updated = await prisma_1.prisma.ticket.update({
            where: { id },
            data: {
                title,
                description,
                status,
                version: { increment: 1 },
            },
        });
        if (req.user) {
            await (0, timeline_1.logTimeline)(id, req.user.id, `Updated ticket (fields changed: ${Object.keys(req.body).join(", ")})`);
        }
        res.json(updated);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "SERVER_ERROR" } });
    }
});
// Add comment to ticket
exports.ticketRouter.post("/:id/comments", auth_1.auth, idempotency_1.idempotency, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!content)
            return res.status(400).json({ error: { code: "FIELD_REQUIRED", message: "Content required" } });
        const ticket = await prisma_1.prisma.ticket.findUnique({ where: { id } });
        if (!ticket)
            return res.status(404).json({ error: { code: "NOT_FOUND" } });
        // Role check: USER can only comment own tickets
        if (req.user.role === "USER" && ticket.createdById !== req.user.id)
            return res.status(403).json({ error: { code: "FORBIDDEN" } });
        const comment = await prisma_1.prisma.comment.create({
            data: {
                content,
                ticketId: id,
                authorId: req.user.id,
            },
            include: { author: true },
        });
        if (req.user) {
            await (0, timeline_1.logTimeline)(id, req.user.id, `Comment added: "${content}"`);
        }
        res.json(comment);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "SERVER_ERROR" } });
    }
});
// Assign ticket to an agent (Admin only)
// PATCH /api/tickets/:id/assign
exports.ticketRouter.patch("/:id/assign", auth_1.auth, (0, auth_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { agentId } = req.body;
        if (!agentId) {
            return res.status(400).json({
                error: { code: "FIELD_REQUIRED", message: "agentId is required" }
            });
        }
        // Check if agent exists and is role AGENT
        const agent = await prisma_1.prisma.user.findUnique({ where: { id: agentId } });
        if (!agent || agent.role !== "AGENT") {
            return res.status(400).json({
                error: { code: "INVALID_AGENT", message: "User is not a valid agent" }
            });
        }
        // Assign ticket to agent
        const ticket = await prisma_1.prisma.ticket.update({
            where: { id },
            data: { assignedToId: agentId },
            include: {
                createdBy: true, // author info
                assignedTo: true, // assigned agent
                comments: true // include comments if needed
            }
        });
        await (0, timeline_1.logTimeline)(id, req.user.id, `Assigned ticket to agent ${agent.name}`);
        res.json(ticket);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "SERVER_ERROR" } });
    }
});
// GET /api/tickets/sla/breached
exports.ticketRouter.get("/sla/breached", auth_1.auth, (0, auth_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        const now = new Date();
        const breachedTickets = await prisma_1.prisma.ticket.findMany({
            where: {
                slaDeadline: { lt: now },
                status: { not: "CLOSED" }, // only open tickets
            },
            include: {
                createdBy: true, // author's user info
                assignedTo: true, // assigned agent
                comments: { orderBy: { createdAt: "asc" } } // all comments sorted
            },
            orderBy: { slaDeadline: "asc" },
        });
        res.json({ items: breachedTickets, count: breachedTickets.length });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "SERVER_ERROR" } });
    }
});
