/**
 * Authentication middleware for protecting routes
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username?: string | null;
        email: string;
        name: string;
        role: string;
        mustResetPassword?: boolean;
      };
    }
  }
}

interface JwtPayload {
  userId: string;
  email: string;
  type: "access" | "refresh";
}

/**
 * Type guard to check if decoded JWT is our expected payload structure
 */
const isJwtPayload = (decoded: unknown): decoded is JwtPayload => {
  if (typeof decoded !== "object" || decoded === null) {
    return false;
  }
  const payload = decoded as Record<string, unknown>;
  return (
    typeof payload.userId === "string" &&
    typeof payload.email === "string" &&
    (payload.type === "access" || payload.type === "refresh")
  );
};

/**
 * Extract JWT token from Authorization header
 */
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
};

/**
 * Verify and decode JWT token
 */
const verifyToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (!isJwtPayload(decoded)) {
      return null;
    }
    if (decoded.type !== "access") {
      return null; // Only accept access tokens in middleware
    }
    return decoded;
  } catch {
    return null;
  }
};

/**
 * Require authentication middleware
 * Protects routes that require a valid JWT token
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication token required",
    });
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
    return;
  }

  // Verify user still exists and is active
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        mustResetPassword: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        error: "Unauthorized",
        message: "User account not found or inactive",
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
    };

    next();
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to verify user",
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is present, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  const payload = verifyToken(token);

  if (!payload) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        mustResetPassword: true,
        isActive: true,
      },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        mustResetPassword: user.mustResetPassword,
      };
    }
  } catch (error) {
    // Silently fail for optional auth
    console.error("Error in optional auth:", error);
  }

  next();
};
