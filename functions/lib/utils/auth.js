"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const https_1 = require("firebase-functions/v2/https");
/**
 * Validates that the request is authenticated.
 */
const requireAuth = (auth) => {
    if (!auth || !auth.uid) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated to perform this action.");
    }
    return auth.uid;
};
exports.requireAuth = requireAuth;
/**
 * Validates that the request has a specific role.
 * Assumes role is stored in custom claims (auth.token.role)
 */
const requireRole = (auth, allowedRoles) => {
    var _a;
    (0, exports.requireAuth)(auth);
    const role = (_a = auth === null || auth === void 0 ? void 0 : auth.token) === null || _a === void 0 ? void 0 : _a.role;
    if (!role || !allowedRoles.includes(role)) {
        throw new https_1.HttpsError("permission-denied", "You do not have permission to perform this action.");
    }
    return role;
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map