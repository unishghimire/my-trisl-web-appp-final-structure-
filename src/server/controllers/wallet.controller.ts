import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { WalletService } from "../services/wallet.service";
import { LedgerCategory, ApiResponse } from "../types";
import { admin, db } from "../db";

export class WalletController {
  /**
   * Processes a manual deposit by an admin.
   */
  static async manualDeposit(req: AuthenticatedRequest, res: Response) {
    try {
      const { targetUserId, amount, referenceId, idempotencyKey } = req.body;

      if (!targetUserId || !amount) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      const result = await WalletService.credit({
        userId: targetUserId,
        amount: Number(amount),
        category: LedgerCategory.DEPOSIT,
        referenceId: referenceId || "manual_admin_deposit",
        idempotencyKey,
        metadata: { adminId: req.user?.userId }
      });

      // Log admin action
      await db.collection("adminLogs").add({
        adminId: req.user?.userId,
        action: "MANUAL_DEPOSIT",
        targetId: targetUserId,
        details: `Deposited ${amount} to user ${targetUserId}`,
        metadata: { referenceId, amount },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: "WALLET_DEPOSIT_FAILED" });
    }
  }

  /**
   * User requests a withdrawal.
   * This debits the balance immediately and marks it as a pending ledger entry.
   */
  static async requestWithdrawal(req: AuthenticatedRequest, res: Response) {
    try {
      const { amount, method, accountDetails, idempotencyKey } = req.body;
      const userId = req.user!.userId;

      if (!amount || amount < 50) { // Example min withdrawal
        return res.status(400).json({ success: false, error: "Minimum withdrawal is 50" });
      }

      // 1. Atomically debit the user
      const result = await WalletService.debit({
        userId,
        amount: Number(amount),
        category: LedgerCategory.WITHDRAWAL,
        referenceId: "withdrawal_pending",
        idempotencyKey,
        metadata: { method, accountDetails }
      });

      // 2. Create the legacy transaction record for Admin Panel visibility if needed
      // (Though the Ledger is the real source of truth now)
      await db.collection("transactions").add({
        userId,
        type: "withdrawal",
        amount: Number(amount),
        method,
        status: "pending",
        accountDetails,
        ledgerId: result.transactionId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: "WALLET_WITHDRAW_FAILED" });
    }
  }

  /**
   * Approves a pending deposit.
   */
  static async approve(req: AuthenticatedRequest, res: Response) {
    try {
      const { transactionId } = req.body;
      const adminId = req.user!.userId;

      const result = await WalletService.approveDeposit(transactionId, adminId);
      
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: "WALLET_APPROVE_FAILED" });
    }
  }

  /**
   * Rejects a pending withdrawal.
   */
  static async reject(req: AuthenticatedRequest, res: Response) {
    try {
      const { transactionId, reason } = req.body;
      const adminId = req.user!.userId;

      const result = await WalletService.rejectWithdrawal(transactionId, adminId, reason);
      
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: "WALLET_REJECT_FAILED" });
    }
  }

  /**
   * Manually refunds a successful transaction.
   */
  static async refund(req: AuthenticatedRequest, res: Response) {
    try {
      const { transactionId } = req.body;
      const adminId = req.user!.userId;

      // Logic to refund: 
      // 1. Get the transaction. 
      // 2. Identify type and amount. 
      // 3. Reverse the operation if it makes sense.
      // For simplicity in this demo, we'll implement a basic balance addition refund.
      
      const result = await db.runTransaction(async (transaction) => {
        const txRef = db.collection("transactions").doc(transactionId);
        const txSnap = await transaction.get(txRef);
        if (!txSnap.exists) throw new Error("Transaction not found");
        const txData = txSnap.data()!;
        
        if (txData.status === "refunded") throw new Error("Already refunded");

        const userRef = db.collection("users").doc(txData.userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("User not found");
        
        const amountToRefund = Math.abs(txData.amount);
        const currentBal = userSnap.data()!.balance || 0;
        const newBal = currentBal + amountToRefund;
        
        transaction.update(userRef, { balance: newBal });
        transaction.update(txRef, { status: "refunded", refundedAt: admin.firestore.FieldValue.serverTimestamp(), refundedBy: adminId });
        
        // Ledger
        const ledgerRef = db.collection("ledger").doc();
        transaction.set(ledgerRef, {
          userId: txData.userId,
          amount: amountToRefund,
          balanceBefore: currentBal,
          balanceAfter: newBal,
          type: "CREDIT",
          category: "refund",
          referenceId: transactionId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { transactionId, newBalance: newBal };
      });

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: "WALLET_REFUND_FAILED" });
    }
  }

  /**
   * Redeems a promo code.
   */
  static async redeemPromo(req: AuthenticatedRequest, res: Response) {
    try {
      const { code } = req.body;
      const userId = req.user!.userId;

      const result = await WalletService.redeemPromo(userId, code);
      
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: "WALLET_PROMO_FAILED" });
    }
  }

  /**
   * Handles tournament entry fee collection and registration atomically.
   */
  static async joinTournament(req: AuthenticatedRequest, res: Response) {
    try {
      const { tournamentId, idempotencyKey, teammates } = req.body;
      const userId = req.user!.userId;

      if (!tournamentId || !idempotencyKey) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      const result = await WalletService.joinTournament(userId, tournamentId, idempotencyKey, teammates);
      
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error("Tournament Join Error:", error);
      res.status(500).json({ success: false, error: error.message, code: "TOURNAMENT_JOIN_FAILED" });
    }
  }
}
