import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

// JWT auth middleware
export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header)
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing token" } });

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string; role: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: { code: "INVALID_TOKEN" } });
  }
};

// Role-based middleware
export const requireRole = (roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } });
  }
  next();
};
