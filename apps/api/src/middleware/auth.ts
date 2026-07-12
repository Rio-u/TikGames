import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type UserRole } from "../lib/jwt.js";

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Mount after requireAuth. Rejects anyone whose token role isn't ADMIN. */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "ADMIN") {
    res.status(403).json({ error: "الصفحة دي للأدمن بس" });
    return;
  }
  next();
}
