import * as admin from "firebase-admin";
import { WalletService } from "./WalletService";

export class WithdrawalService {
  private static get db() {
    return admin.firestore();
  }

  /**
   * Request a withdrawal (called by user).
   */
  static async requestWithdrawal(userId: string, amount: number, method: string, address: string) {
    if (amount <= 0) throw new Error("Invalid withdrawal amount");

    return this.db.runTransaction(async (t) => {
      const userRef = this.db.collection("users").doc(userId);
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");
      
      const balance = userDoc.data()?.balance || 0;
      if (balance < amount) {
        throw new Error("Insufficient balance for withdrawal");
      }

      // 1. Deduct immediately from balance to prevent double spending
      await WalletService.deductFunds(userId, amount, "N/A", { type: "WITHDRAWAL_REQUEST" }, t);

      // 2. Create Withdrawal Record
      const withdrawRef = this.db.collection("withdrawals").doc();
      const withdrawData = {
        userId,
        amount,
        method,
        address,
        status: "pending",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      t.set(withdrawRef, withdrawData);

      return { success: true, withdrawalId: withdrawRef.id, amount };
    });
  }

  /**
   * Approves a withdrawal and finalizes it.
   */
  static async approveWithdrawal(withdrawalId: string, adminId: string, txHash?: string) {
    return this.db.runTransaction(async (t) => {
      const wRef = this.db.collection("withdrawals").doc(withdrawalId);
      const wDoc = await t.get(wRef);
      if (!wDoc.exists) throw new Error("Withdrawal not found");

      const data = wDoc.data()!;
      if (data.status !== "pending" && data.status !== "processing") {
        throw new Error("Withdrawal is not pending");
      }

      t.update(wRef, {
        status: "completed",
        txHash: txHash || null,
        approvedBy: adminId,
        approvedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Audit Log
      const auditRef = this.db.collection("auditLogs").doc();
      t.set(auditRef, {
        action: "APPROVE_WITHDRAWAL",
        withdrawalId,
        adminId,
        amount: data.amount,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, withdrawalId };
    });
  }

  /**
   * Rejects a withdrawal and refunds the money back to the user balance.
   */
  static async rejectWithdrawal(withdrawalId: string, adminId: string, reason: string) {
    return this.db.runTransaction(async (t) => {
      const wRef = this.db.collection("withdrawals").doc(withdrawalId);
      const wDoc = await t.get(wRef);
      if (!wDoc.exists) throw new Error("Withdrawal not found");

      const data = wDoc.data()!;
      if (data.status !== "pending" && data.status !== "processing") {
        throw new Error("Withdrawal is not pending");
      }

      // Refund the user
      await WalletService.addFunds(
        data.userId, 
        data.amount, 
        withdrawalId, 
        "WITHDRAWAL_REJECTED_REFUND", 
        { reason }, 
        t
      );

      t.update(wRef, {
        status: "rejected",
        reason,
        rejectedBy: adminId,
        rejectedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Audit Log
      const auditRef = this.db.collection("auditLogs").doc();
      t.set(auditRef, {
        action: "REJECT_WITHDRAWAL",
        withdrawalId,
        adminId,
        amount: data.amount,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, withdrawalId };
    });
  }
}
