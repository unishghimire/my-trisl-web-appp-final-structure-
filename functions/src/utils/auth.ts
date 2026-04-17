import { HttpsError } from "firebase-functions/v2/https";

export interface AuthContext {
  uid: string;
  token: any;
}

/**
 * Validates that the request is authenticated.
 */
export const requireAuth = (auth?: AuthContext): string => {
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated to perform this action.");
  }
  return auth.uid;
};

/**
 * Validates that the request has a specific role.
 * Assumes role is stored in custom claims (auth.token.role)
 */
export const requireRole = (auth: AuthContext | undefined, allowedRoles: string[]) => {
  requireAuth(auth);
  const role = auth?.token?.role;
  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError("permission-denied", "You do not have permission to perform this action.");
  }
  return role;
};
