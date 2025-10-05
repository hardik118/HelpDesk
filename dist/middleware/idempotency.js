"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idempotency = void 0;
const store = {};
const TTL = 5 * 60 * 1000; // 5 minutes
const idempotency = (req, res, next) => {
    if (req.method !== "POST")
        return next();
    const key = req.headers["idempotency-key"];
    if (!key)
        return next(); // optional: enforce?
    if (store[key]) {
        // Return cached response
        return res.json(store[key].responseData);
    }
    // Override res.json to store the response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
        store[key] = { responseData: data, timestamp: Date.now() };
        // Cleanup old entries
        Object.keys(store).forEach(k => {
            if (Date.now() - store[k].timestamp > TTL)
                delete store[k];
        });
        return originalJson(data);
    };
    next();
};
exports.idempotency = idempotency;
