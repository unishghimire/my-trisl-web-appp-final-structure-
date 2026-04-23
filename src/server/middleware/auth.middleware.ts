import { Request, Response, NextFunction } from "express";
import { Role } from "../types";
import { db, admin } from "../db";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    username: string;
    role: Role;
  };
}

/**
 * Middleware to authenticate Firebase ID Token and populate req.user
 */
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }

  const idToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Fetch latest role and details from Firestore
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return res.status(401).json({ success: false, error: "User profile not found", code: "USER_NOT_FOUND" });
    }

    const userData = userDoc.data()!;
    if (userData.isBanned) {
      return res.status(403).json({ success: false, error: "Account is banned", code: "USER_BANNED" });
    }

    req.user = {
      userId: decodedToken.uid,
      email: decodedToken.email || "",
      username: userData.username || "",
      role: userData.role as Role
    };
    next();
  } catch (error: any) {
    console.error("Auth Error:", error);
    return res.status(401).json({ success: false, error: `Auth Error: ${error.message || 'Invalid token'}`, code: "AUTH_INVALID" });
  }
};

/**
 * Middleware to authorize specific roles
 */
export const authorize = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Permission denied", code: "FORBIDDEN" });
    }

    next();
  };
};

/**
 * Specialized middleware for admin-only actions
 */
export const adminOnly = authorize([Role.ADMIN]);

/**
 * Specialized middleware for organizer or admin actions
 */
export const organizerOrAdmin = authorize([Role.ORG, Role.ADMIN]);
