"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalService = void 0;
const admin = require("firebase-admin");
const WalletService_1 = require("./WalletService");
class WithdrawalService {
    static get db() {
        return admin.firestore();
    }
    /**
     * Request a withdrawal (called by user).
     */
    static async requestWithdrawal(userId, amount, method, address) {
        if (amount <= 0)
            throw new Error("Invalid withdrawal amount");
        return this.db.runTransaction(async (t) => {
            var _a;
            const userRef = this.db.collection("users").doc(userId);
            const userDoc = await t.get(userRef);
            if (!userDoc.exists)
                throw new Error("User not found");
            const balance = ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.balance) || 0;
            if (balance < amount) {
                throw new Error("Insufficient balance for withdrawal");
            }
            // 1. Deduct immediately from balance to prevent double spending
            await WalletService_1.WalletService.deductFunds(userId, amount, "N/A", { type: "WITHDRAWAL_REQUEST" }, t);
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
    static async approveWithdrawal(withdrawalId, adminId, txHash) {
        return this.db.runTransaction(async (t) => {
            const wRef = this.db.collection("withdrawals").doc(withdrawalId);
            const wDoc = await t.get(wRef);
            if (!wDoc.exists)
                throw new Error("Withdrawal not found");
            const data = wDoc.data();
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
    static async rejectWithdrawal(withdrawalId, adminId, reason) {
        return this.db.runTransaction(async (t) => {
            const wRef = this.db.collection("withdrawals").doc(withdrawalId);
            const wDoc = await t.get(wRef);
            if (!wDoc.exists)
                throw new Error("Withdrawal not found");
            const data = wDoc.data();
            if (data.status !== "pending" && data.status !== "processing") {
                throw new Error("Withdrawal is not pending");
            }
            // Refund the user
            await WalletService_1.WalletService.addFunds(data.userId, data.amount, withdrawalId, "WITHDRAWAL_REJECTED_REFUND", { reason }, t);
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
exports.WithdrawalService = WithdrawalService;
//# sourceMappingURL=WithdrawalService.js.map