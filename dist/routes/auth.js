"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
exports.authRouter = (0, express_1.Router)();
// Utility to remove password from user object
const sanitizeUser = (user) => {
    const { password, ...safeUser } = user;
    return safeUser;
};
// Register
exports.authRouter.post("/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                error: { code: "FIELD_REQUIRED", message: "Name, email and password are required" },
            });
        }
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ error: { code: "EMAIL_EXISTS", message: "Email already exists" } });
        }
        const hash = await bcryptjs_1.default.hash(password, 10);
        // Ensure role is valid
        const validRoles = ["USER", "AGENT", "ADMIN"];
        const assignedRole = validRoles.includes(role) ? role : "USER";
        const user = await prisma_1.prisma.user.create({
            data: { name, email, password: hash, role: assignedRole },
        });
        res.json(sanitizeUser(user));
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "SERVER_ERROR" } });
    }
});
// Login
exports.authRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: { code: "FIELD_REQUIRED", message: "Email and password required" } });
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(400).json({ error: { code: "INVALID_CREDENTIALS" } });
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            return res.status(400).json({ error: { code: "INVALID_CREDENTIALS" } });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, user: sanitizeUser(user) });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: { code: "SERVER_ERROR" } });
    }
});
