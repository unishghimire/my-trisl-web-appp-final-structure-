import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireRole } from "../utils/auth";
import { validateInput } from "../utils/validation";
import { WithdrawalService } from "../services/WithdrawalService";
import { RevenueService } from "../services/RevenueService";
import { RefundService } from "../services/RefundService";
import { WalletService } from "../services/WalletService";
import { handleError } from "../utils/errorHandler";
import * as admin from "firebase-admin";

/**
 * Ensures only admins can execute functions in this module.
 */
const requireAdmin = (auth: any) => requireRole(auth, ["admin"]);

export const adminApproveWithdrawal = onCall(async (request) => {
  try {
    const adminUID = requireAdmin(request.auth);
    validateInput(request.data, ["withdrawalId", "txHash"]);
    const { withdrawalId, txHash } = request.data;

    return await WithdrawalService.approveWithdrawal(withdrawalId, adminUID, txHash);
  } catch (error) {
    handleError(error);
  }
});

export const adminRejectWithdrawal = onCall(async (request) => {
  try {
    const adminUID = requireAdmin(request.auth);
    validateInput(request.data, ["withdrawalId", "reason"]);
    const { withdrawalId, reason } = request.data;

    return await WithdrawalService.rejectWithdrawal(withdrawalId, adminUID, reason);
  } catch (error) {
    handleError(error);
  }
});

export const adminReleaseEarnings = onCall(async (request) => {
  try {
    requireAdmin(request.auth);
    validateInput(request.data, ["tournamentId"]);
    const { tournamentId } = request.data;

    // We assume the earnings record was created by RevenueService trigger already.
    const db = admin.firestore();
    return await db.runTransaction(async (t) => {
      const earningsRef = db.collection("tournamentEarnings").doc(tournamentId);
      const earningsDoc = await t.get(earningsRef);

      if (!earningsDoc.exists) throw new HttpsError("not-found", "Earnings record not found. Did the tournament complete?");
      const data = earningsDoc.data()!;

      if (data.status === "released") throw new HttpsError("already-exists", "Earnings already released.");

      // Credit organizer wallet via WalletService logic in transaction
      await WalletService.addFunds(data.orgId, data.orgShare, tournamentId, "ORGANIZER_EARNINGS", { action: "EARNINGS_RELEASE" }, t);

      t.update(earningsRef, {
        status: "released",
        releasedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    });
  } catch (error) {
    handleError(error);
  }
});

export const adminRefundTournament = onCall(async (request) => {
  try {
    const adminUID = requireAdmin(request.auth);
    validateInput(request.data, ["tournamentId"]);
    const { tournamentId } = request.data;

    return await RefundService.refundTournament(tournamentId, adminUID);
  } catch (error) {
    handleError(error);
  }
});
