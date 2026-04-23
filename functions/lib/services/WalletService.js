"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const admin = require("firebase-admin");
class WalletService {
    static get db() {
        return admin.firestore();
    }
    /**
     * Deduct entry fee from a user's wallet generically.
     */
    static async deductFunds(userId, amount, referenceId, metadata, transaction) {
        if (amount <= 0)
            throw new Error("Amount must be positive.");
        const execute = async (t) => {
            var _a;
            const userRef = this.db.collection("users").doc(userId);
            const userDoc = await t.get(userRef);
            if (!userDoc.exists)
                throw new Error("User not found.");
            const currentBalance = ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.balance) || 0;
            if (currentBalance < amount) {
                throw new Error("Insufficient balance.");
            }
            const newBalance = currentBalance - amount;
            t.update(userRef, { balance: newBalance });
            const ledgerRef = this.db.collection("ledger").doc();
            t.set(ledgerRef, {
                userId,
                amount: -amount,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                type: "DEBIT",
                referenceId,
                metadata,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Audit Log
            const auditRef = this.db.collection("auditLogs").doc();
            t.set(auditRef, {
                action: "DEBIT",
                userId,
                amount,
                status: "SUCCESS",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            return { newBalance, transactionId: ledgerRef.id };
        };
        if (transaction)
            return execute(transaction);
        return this.db.runTransaction(execute);
    }
    /**
     * Add funds to a user's wallet
     */
    static async addFunds(userId, amount, referenceId, category, metadata, transaction) {
        if (amount <= 0)
            throw new Error("Amount must be positive.");
        const execute = async (t) => {
            var _a;
            const userRef = this.db.collection("users").doc(userId);
            const userDoc = await t.get(userRef);
            if (!userDoc.exists)
                throw new Error("User not found.");
            const currentBalance = ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.balance) || 0;
            const newBalance = currentBalance + amount;
            t.update(userRef, { balance: newBalance });
            const ledgerRef = this.db.collection("ledger").doc();
            t.set(ledgerRef, {
                userId,
                amount: amount,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                type: "CREDIT",
                category,
                referenceId,
                metadata,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Audit Log
            const auditRef = this.db.collection("auditLogs").doc();
            t.set(auditRef, {
                action: "CREDIT",
                category,
                userId,
                amount,
                status: "SUCCESS",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            return { newBalance, transactionId: ledgerRef.id };
        };
        if (transaction)
            return execute(transaction);
        return this.db.runTransaction(execute);
    }
}
exports.WalletService = WalletService;
//# sourceMappingURL=WalletService.js.map