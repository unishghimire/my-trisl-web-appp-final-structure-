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

export const adminRejectTransaction = onCall(async (request) => {
  try {
    const adminUID = requireAdmin(request.auth);
    validateInput(request.data, ["transactionId", "reason"]);
    const { transactionId, reason } = request.data;

    const db = admin.firestore();
    const result = await db.runTransaction(async (t) => {
      // Check legacy generic transactions
      const txRef = db.collection("transactions").doc(transactionId);
      const txDoc = await t.get(txRef);

      if (txDoc.exists) {
        const txData = txDoc.data()!;
        if (txData.status !== "pending") throw new HttpsError("failed-precondition", "Transaction is not pending");

        if (txData.type === "deposit") {
            // Reject deposit
            t.update(txRef, {
                status: "rejected",
                rejectionReason: reason,
                rejectedBy: adminUID,
                rejectedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, transactionId };
        } else if (txData.type === "withdrawal") {
            // Reject legacy withdrawal (Needs funds refunded!)
            await WalletService.addFunds(txData.userId, Number(txData.amount), transactionId, "WITHDRAWAL_REJECTED_REFUND", { reason }, t);
            t.update(txRef, {
                status: "rejected",
                rejectionReason: reason,
                rejectedBy: adminUID,
                rejectedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, transactionId };
        }
      }

      // Check V2 'withdrawals' collection
      const wRef = db.collection("withdrawals").doc(transactionId);
      const wDoc = await t.get(wRef);
      if (wDoc.exists) {
        return null; // Return null so we can invoke WithdrawalService outside of this transaction payload block
      }
      
      throw new HttpsError("not-found", "Transaction not found");
    });

    if (result === null) {
        return await WithdrawalService.rejectWithdrawal(transactionId, adminUID, reason);
    }
    
    return result;
  } catch (error) {
    handleError(error);
  }
});
export const adminApproveTransaction = onCall(async (request) => {
  try {
    const adminUID = requireAdmin(request.auth);
    validateInput(request.data, ["transactionId"]);
    const { transactionId } = request.data;

    const db = admin.firestore();
    const result = await db.runTransaction(async (t) => {
      // Check if it's a legacy generic transaction (like a deposit)
      const txRef = db.collection("transactions").doc(transactionId);
      const txDoc = await t.get(txRef);
      
      if (txDoc.exists) {
        const txData = txDoc.data()!;
        if (txData.status !== "pending") throw new HttpsError("failed-precondition", "Transaction is not pending");
        
        if (txData.type === "deposit") {
          // Deposit approval logic
          await WalletService.addFunds(txData.userId, Number(txData.amount), transactionId, "DEPOSIT_APPROVED", { adminUID }, t);
          t.update(txRef, {
            status: "completed",
            approvedBy: adminUID,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return { success: true, transactionId };
        } else if (txData.type === "withdrawal") {
           // Withdrawal approval logic for legacy transactions
           t.update(txRef, {
            status: "completed",
            approvedBy: adminUID,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          // Ledger handling already done on request in V1
          return { success: true, transactionId };
        }
      }

      // Check if it's a V2 withdrawal in the 'withdrawals' collection
      const wRef = db.collection("withdrawals").doc(transactionId);
      const wDoc = await t.get(wRef);
      if (wDoc.exists) {
         return null; // Return null to signal we should call it outside this nested transaction
      }

      throw new HttpsError("not-found", "Transaction not found");
    });
    
    // Call the V2 service outside the runTransaction block if it was a V2 withdrawal
    if (result === null) {
        return await WithdrawalService.approveWithdrawal(transactionId, adminUID, "manual_approval");
    }

    return result;
  } catch (error) {
    handleError(error);
  }
});
export const adminAdjustBalance = onCall(async (request) => {
  try {
    const adminUID = requireAdmin(request.auth);
    validateInput(request.data, ["targetUserId", "amount"]);
    
    let { targetUserId, amount, referenceId } = request.data;
    amount = parseFloat(amount.toString());

    if (isNaN(amount) || amount === 0) {
      throw new HttpsError("invalid-argument", "Amount must be a non-zero number.");
    }

    if (!referenceId) {
       referenceId = `admin_adj_${adminUID}_${Date.now()}`;
    }

    const db = admin.firestore();
    return await db.runTransaction(async (t) => {
        if (amount > 0) {
            await WalletService.addFunds(targetUserId, amount, referenceId, "ADMIN_ADJUSTMENT", { adminUID }, t);
        } else {
            await WalletService.deductFunds(targetUserId, Math.abs(amount), referenceId, { adminUID, action: "ADMIN_DEDUCTION" }, t);
        }
        return { success: true, adjustedAmount: amount };
    });
  } catch (error) {
    handleError(error);
  }
});

export const adminSetAdmin = onCall(async (request) => {
  try {
    requireAdmin(request.auth);
    const { userId, role } = request.data;
    await admin.auth().setCustomUserClaims(userId, { role });
    return { success: true };
  } catch (error) {
    handleError(error);
  }
});

export const adminRemoveAdmin = onCall(async (request) => {
  try {
    requireAdmin(request.auth);
    const { userId } = request.data;
    
    // Protection for super admin
    if (userId === 'b2uzD6jTsyZkxmud73D8qgYWRol2') {
        throw new HttpsError('permission-denied', 'Cannot remove super admin');
    }
    
    await admin.auth().setCustomUserClaims(userId, { role: 'user' });
    return { success: true };
  } catch (error) {
    handleError(error);
  }
});

