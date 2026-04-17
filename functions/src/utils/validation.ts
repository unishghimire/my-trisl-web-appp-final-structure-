import { HttpsError } from "firebase-functions/v2/https";

/**
 * Ensures strict input validation to prevent poorly formatted data processing.
 */
export const validateInput = (data: any, requiredFields: string[]) => {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Missing request body / data.");
  }
  
  const missing = requiredFields.filter(f => data[f] === undefined || data[f] === null || data[f] === "");
  if (missing.length > 0) {
    throw new HttpsError("invalid-argument", `Missing required fields: ${missing.join(", ")}`);
  }
};

/**
 * Ensures amount is a positive number.
 */
export const validateAmount = (amount: any): number => {
  const parsed = Number(amount);
  if (isNaN(parsed) || parsed <= 0) {
    throw new HttpsError("invalid-argument", "Amount must be a positive number greater than 0.");
  }
  return parsed;
};
