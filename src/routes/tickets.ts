import { Router } from "express";
import { prisma } from "../prisma";
import { auth, requireRole, AuthRequest } from "../middleware/auth";
import { getSlaDue } from "../utils/sla";
import { rateLimit } from "../middleware/rateLimit";
import { idempotency } from "../middleware/idempotency";
import { logTimeline } from "../utils/timeline";


export const ticketRouter = Router();

ticketRouter.use(auth, rateLimit);


// Create Ticket (USER)
ticketRouter.post("/", auth, requireRole(["USER"]), idempotency,  async (req: AuthRequest, res) => {
  try {
    const { title, description, priority } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: { code: "FIELD_REQUIRED", message: "Title and description required" } });
    }

    const slaDeadline = getSlaDue(priority);

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        slaDeadline,
        createdById: req.user!.id,
      },
    });
    await logTimeline(ticket.id, req.user!.id, "Created ticket");


    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
});

// List Tickets (with search, pagination)
ticketRouter.get("/", auth, async (req: AuthRequest, res) => {
  try {
    const { limit = 10, offset = 0, q } = req.query;

    const where: any = {};
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
    if (req.user!.role === "USER") where.createdById = req.user!.id;
    else if (req.user!.role === "AGENT") where.assignedToId = req.user!.id;

    const tickets = await prisma.ticket.findMany({
      where,
      skip: Number(offset),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: { comments: true },
    });

    res.json({ items: tickets, next_offset: Number(offset) + tickets.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
});

// Get single ticket with comments
ticketRouter.get("/:id", auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { comments: { include: { author: true } } },
    });

    if (!ticket) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });

    // Role check
    if (req.user!.role === "USER" && ticket.createdById !== req.user!.id)
      return res.status(403).json({ error: { code: "FORBIDDEN" } });
    if (req.user!.role === "AGENT" && ticket.assignedToId !== req.user!.id)
      return res.status(403).json({ error: { code: "FORBIDDEN" } });

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
});

// Update ticket (optimistic locking)
ticketRouter.patch("/:id", auth, requireRole(["USER", "AGENT", "ADMIN"]), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, version } = req.body;

    if (!version) {
      return res.status(400).json({ error: { code: "FIELD_REQUIRED", message: "Version required" } });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: { code: "NOT_FOUND" } });

    // Check optimistic locking
    if (ticket.version !== version)
      return res.status(409).json({ error: { code: "STALE_UPDATE", message: "Ticket has been updated already" } });

    // Role-based update check
    if (req.user!.role === "USER" && ticket.createdById !== req.user!.id)
      return res.status(403).json({ error: { code: "FORBIDDEN" } });
    if (req.user!.role === "AGENT" && ticket.assignedToId !== req.user!.id)
      return res.status(403).json({ error: { code: "FORBIDDEN" } });

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        title,
        description,
        status,
        version: { increment: 1 },
      },
    });
if (req.user) {
  await logTimeline(id, req.user.id, `Updated ticket (fields changed: ${Object.keys(req.body).join(", ")})`);
}

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
});

// Add comment to ticket
ticketRouter.post("/:id/comments", auth, idempotency, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) return res.status(400).json({ error: { code: "FIELD_REQUIRED", message: "Content required" } });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: { code: "NOT_FOUND" } });

    // Role check: USER can only comment own tickets
    if (req.user!.role === "USER" && ticket.createdById !== req.user!.id)
      return res.status(403).json({ error: { code: "FORBIDDEN" } });

    const comment = await prisma.comment.create({
      data: {
        content,
        ticketId: id,
        authorId: req.user!.id,
      },
      include: { author: true },
    });
if (req.user) {
  await logTimeline(id, req.user.id, `Comment added: "${content}"`);
}

    res.json(comment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
});


// Assign ticket to an agent (Admin only)
// PATCH /api/tickets/:id/assign
ticketRouter.patch("/:id/assign", auth, requireRole(["ADMIN"]), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ 
        error: { code: "FIELD_REQUIRED", message: "agentId is required" } 
      });
    }

    // Check if agent exists and is role AGENT
    const agent = await prisma.user.findUnique({ where: { id: agentId } });
    if (!agent || agent.role !== "AGENT") {
      return res.status(400).json({ 
        error: { code: "INVALID_AGENT", message: "User is not a valid agent" } 
      });
    }

    // Assign ticket to agent
    const ticket = await prisma.ticket.update({
      where: { id },
      data: { assignedToId: agentId },
      include: {
        createdBy: true,   // author info
        assignedTo: true,  // assigned agent
        comments: true     // include comments if needed
      }
    });
await logTimeline(id, req.user!.id, `Assigned ticket to agent ${agent.name}`);

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
});



// GET /api/tickets/sla/breached
ticketRouter.get("/sla/breached", auth, requireRole(["ADMIN"]), async (req: AuthRequest, res) => {
  try {
    const now = new Date();

    const breachedTickets = await prisma.ticket.findMany({
      where: {
        slaDeadline: { lt: now },
        status: { not: "CLOSED" }, // only open tickets
      },
      include: { 
        createdBy: true,      // author's user info
        assignedTo: true,     // assigned agent
        comments: { orderBy: { createdAt: "asc" } } // all comments sorted
      },
      orderBy: { slaDeadline: "asc" },
    });

    res.json({ items: breachedTickets, count: breachedTickets.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
});



