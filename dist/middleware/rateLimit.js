"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = void 0;
// Simple in-memory store for demo; for production use Redis or similar
const userRequests = {};
const LIMIT = 60; // requests
const WINDOW = 60 * 1000; // 60 seconds
const rateLimit = (req, res, next) => {
    const userId = String(req.user?.id || req.ip); // fallback to IP if unauthenticated
    const now = Date.now();
    if (!userRequests[userId]) {
        userRequests[userId] = { count: 1, lastReset: now };
        return next();
    }
    const userData = userRequests[userId];
    if (now - userData.lastReset > WINDOW) {
        // Reset window
        userData.count = 1;
        userData.lastReset = now;
        return next();
    }
    if (userData.count >= LIMIT) {
        return res.status(429).json({ error: { code: "RATE_LIMIT", message: "Too many requests" } });
    }
    userData.count += 1;
    next();
};
exports.rateLimit = rateLimit;
