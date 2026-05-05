import express, { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from ".";

export interface AuthPayload {
    userId: string;
    email: string;
  }
  
  export interface AuthRequest extends Request {
    user?: AuthPayload;
  }

export function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or malformed Authorization header" });
      return;
    }
  
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  }
  