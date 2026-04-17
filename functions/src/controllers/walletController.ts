import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth } from "../utils/auth";
import { validateInput, validateAmount } from "../utils/validation";
import { WithdrawalService } from "../services/WithdrawalService";
import { handleError } from "../utils/errorHandler";

/**
 * requestWithdrawal - Secure withdrawal processing to prevent double spending
 * Locks funds immediately.
 */
export const requestWithdrawal = onCall(async (request) => {
  try {
    const uid = requireAuth(request.auth);
    validateInput(request.data, ["amount", "method", "address"]);
    
    const amount = validateAmount(request.data.amount);
    const { method, address } = request.data;

    const result = await WithdrawalService.requestWithdrawal(uid, amount, method, address);
    
    return result;
  } catch (error) {
    handleError(error);
  }
});
