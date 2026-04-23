"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAmount = exports.validateInput = void 0;
const https_1 = require("firebase-functions/v2/https");
/**
 * Ensures strict input validation to prevent poorly formatted data processing.
 */
const validateInput = (data, requiredFields) => {
    if (!data || typeof data !== "object") {
        throw new https_1.HttpsError("invalid-argument", "Missing request body / data.");
    }
    const missing = requiredFields.filter(f => data[f] === undefined || data[f] === null || data[f] === "");
    if (missing.length > 0) {
        throw new https_1.HttpsError("invalid-argument", `Missing required fields: ${missing.join(", ")}`);
    }
};
exports.validateInput = validateInput;
/**
 * Ensures amount is a positive number.
 */
const validateAmount = (amount) => {
    const parsed = Number(amount);
    if (isNaN(parsed) || parsed <= 0) {
        throw new https_1.HttpsError("invalid-argument", "Amount must be a positive number greater than 0.");
    }
    return parsed;
};
exports.validateAmount = validateAmount;
//# sourceMappingURL=validation.js.map