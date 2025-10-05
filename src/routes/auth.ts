import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const authRouter = Router();

// Utility to remove password from user object
const sanitizeUser = (user: any) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

// Register
authRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: { code: "FIELD_REQUIRED", message: "Name, email and password are required" },
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: { code: "EMAIL_EXISTS", message: "Email already exists" } });
    }

    const hash = await bcrypt.hash(password, 10);

    // Ensure role is valid
    const validRoles = ["USER", "AGENT", "ADMIN"];
    const assignedRole = validRoles.includes(role) ? role : "USER";

    const user = await prisma.user.create({
      data: { name, email, password: hash, role: assignedRole },
    });

    res.json(sanitizeUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
});

// Login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { code: "FIELD_REQUIRED", message: "Email and password required" } });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: { code: "INVALID_CREDENTIALS" } });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: { code: "INVALID_CREDENTIALS" } });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );

    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { code: "SERVER_ERROR" } });
  }
});
