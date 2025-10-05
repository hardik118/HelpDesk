import { Request, Response, NextFunction } from "express";

interface IdempotentEntry {
  responseData: any;
  timestamp: number;
}

const store: Record<string, IdempotentEntry> = {};
const TTL = 5 * 60 * 1000; // 5 minutes

export const idempotency = (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "POST") return next();

  const key = req.headers["idempotency-key"] as string;
  if (!key) return next(); // optional: enforce?

  if (store[key]) {
    // Return cached response
    return res.json(store[key].responseData);
  }

  // Override res.json to store the response
  const originalJson = res.json.bind(res);
  res.json = (data: any) => {
    store[key] = { responseData: data, timestamp: Date.now() };
    // Cleanup old entries
    Object.keys(store).forEach(k => {
      if (Date.now() - store[k].timestamp > TTL) delete store[k];
    });
    return originalJson(data);
  };

  next();
};
