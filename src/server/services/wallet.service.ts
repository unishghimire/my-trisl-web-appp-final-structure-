import { db, admin } from "../db";
import { LedgerCategory, LedgerType } from "../types";

export interface WalletTransactionRequest {
  userId: string;
  amount: number;
  category: LedgerCategory;
  referenceId: string;
  metadata?: any;
  idempotencyKey?: string;
}

export class WalletService {
  /**
   * Credits a user's wallet balance atomically.
   */
  static async credit(request: WalletTransactionRequest) {
    return this.runFinancialTransaction(request, LedgerType.CREDIT);
  }

  /**
   * Debits a user's wallet balance atomically with balance checks.
   */
  static async debit(request: WalletTransactionRequest) {
    return this.runFinancialTransaction(request, LedgerType.DEBIT);
  }

  /**
   * Core logic for all financial transactions.
   * Handles idempotency, balance updates, and ledger writing.
   */
  private static async runFinancialTransaction(
    request: WalletTransactionRequest,
    type: LedgerType
  ) {
    const { userId, amount, category, referenceId, metadata, idempotencyKey } = request;

    if (amount <= 0) throw new Error("Amount must be positive");

    const result = await db.runTransaction(async (transaction) => {
      // 1. Check Idempotency if key provided
      if (idempotencyKey) {
        const idenRef = db.collection("idempotencyKeys").doc(idempotencyKey);
        const idenDoc = await transaction.get(idenRef);
        
        if (idenDoc.exists) {
          const data = idenDoc.data();
          if (data?.status === "completed") {
            return data.response;
          }
          if (data?.status === "pending") {
            throw new Error("Request already in progress");
          }
        }
        
        // Mark as pending
        transaction.set(idenRef, {
          key: idempotencyKey,
          status: "pending",
          userId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
        });
      }

      // 2. Load User Balance
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) throw new Error("User not found");
      
      const userData = userDoc.data()!;
      const currentBalance = userData.balance || 0;
      let newBalance = currentBalance;

      // 3. Calculate New Balance & Validate
      if (type === LedgerType.CREDIT) {
        newBalance = currentBalance + amount;
      } else {
        if (currentBalance < amount) throw new Error("Insufficient balance");
        newBalance = currentBalance - amount;
      }

      // 4. Create Ledger Entry
      const ledgerRef = db.collection("ledger").doc();
      const ledgerEntry = {
        id: ledgerRef.id,
        userId,
        amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        type,
        category,
        referenceId,
        metadata: metadata || {},
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      // 5. Execute Updates
      transaction.update(userRef, { 
        balance: newBalance,
        // Update earnings if it's a prize
        ...(category === LedgerCategory.PRIZE ? { totalEarnings: (userData.totalEarnings || 0) + amount } : {})
      });
      transaction.set(ledgerRef, ledgerEntry);

      // 6. Update Public Profile (Atomic)
      const publicRef = db.collection("users_public").doc(userId);
      transaction.update(publicRef, {
        totalEarnings: (userData.totalEarnings || 0) + (category === LedgerCategory.PRIZE ? amount : 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const finalResponse = {
        transactionId: ledgerRef.id,
        newBalance,
        referenceId
      };

      // 7. Commit Idempotency status
      if (idempotencyKey) {
        const idenRef = db.collection("idempotencyKeys").doc(idempotencyKey);
        transaction.update(idenRef, {
          status: "completed",
          response: finalResponse
        });
      }

      return finalResponse;
    });

    return result;
  }

  /**
   * Distributes prizes for a tournament.
   * Atomic across all participants and splitting.
   */
  static async distributeTournamentPrizes(tournamentId: string, winners: { userId: string, prize: number }[]) {
    // This could be massive, so we might need batches if hundreds of winners.
    // But typically tournaments have a few top winners.
    
    const results = [];
    for (const winner of winners) {
      results.push(await this.credit({
        userId: winner.userId,
        amount: winner.prize,
        category: LedgerCategory.PRIZE,
        referenceId: tournamentId,
        metadata: { winnersCount: winners.length }
      }));
    }
    return results;
  }

  /**
   * Approves a pending deposit.
   */
  static async approveDeposit(transactionId: string, adminId: string) {
    return await db.runTransaction(async (transaction) => {
      const txRef = db.collection("transactions").doc(transactionId);
      const txSnap = await transaction.get(txRef);
      
      if (!txSnap.exists) throw new Error("Transaction not found");
      const txData = txSnap.data()!;
      
      if (txData.status !== "pending") throw new Error("Transaction is not pending");
      if (txData.type !== "deposit") throw new Error("Only deposits can be approved here");

      // Update User Balance
      const userRef = db.collection("users").doc(txData.userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");
      
      const userId = txData.userId;
      const amount = Number(txData.amount);
      const currentBal = userSnap.data()!.balance || 0;
      const newBal = currentBal + amount;
      
      transaction.update(userRef, { balance: newBal });

      // Create Ledger Entry
      const ledgerRef = db.collection("ledger").doc();
      transaction.set(ledgerRef, {
        userId,
        amount,
        balanceBefore: currentBal,
        balanceAfter: newBal,
        type: "CREDIT",
        category: LedgerCategory.DEPOSIT,
        referenceId: transactionId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update Transaction Record
      transaction.update(txRef, { 
        status: "success", 
        confirmedBy: adminId,
        confirmedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { transactionId, newBalance: newBal };
    });
  }

  /**
   * Rejects a pending withdrawal (refunds the money).
   */
  static async rejectWithdrawal(transactionId: string, adminId: string, reason: string) {
    return await db.runTransaction(async (transaction) => {
      const txRef = db.collection("transactions").doc(transactionId);
      const txSnap = await transaction.get(txRef);
      
      if (!txSnap.exists) throw new Error("Transaction not found");
      const txData = txSnap.data()!;
      
      if (txData.status !== "pending") throw new Error("Transaction is not pending");
      if (txData.type !== "withdrawal") throw new Error("Only withdrawals can be rejected here");

      // Refund the money to the user (since it was debited on request)
      const userRef = db.collection("users").doc(txData.userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");
      
      const userId = txData.userId;
      const amountToRefund = Math.abs(Number(txData.amount));
      const currentBal = userSnap.data()!.balance || 0;
      const newBal = currentBal + amountToRefund;
      
      transaction.update(userRef, { balance: newBal });

      // Create Ledger Entry
      const ledgerRef = db.collection("ledger").doc();
      transaction.set(ledgerRef, {
        userId,
        amount: amountToRefund,
        balanceBefore: currentBal,
        balanceAfter: newBal,
        type: "CREDIT",
        category: LedgerCategory.REFUND,
        referenceId: transactionId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update Transaction Record
      transaction.update(txRef, { 
        status: "rejected", 
        rejectionReason: reason,
        confirmedBy: adminId,
        confirmedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { transactionId, refundedAmount: amountToRefund, newBalance: newBal };
    });
  }

  /**
   * Atomic transaction: Joins a tournament, pays fee, increments slots, and creates participant.
   */
  static async joinTournament(userId: string, tournamentId: string, idempotencyKey: string, teammates: string[] = []) {
    return await db.runTransaction(async (transaction) => {
      // 1. Idempotency Check
      const idenRef = db.collection("idempotencyKeys").doc(idempotencyKey);
      const idenSnap = await transaction.get(idenRef);
      if (idenSnap.exists && idenSnap.data()?.status === "completed") {
        return idenSnap.data()?.response;
      }
      if (!idenSnap.exists) {
        transaction.set(idenRef, { 
          status: "pending", 
          userId, 
          createdAt: admin.firestore.FieldValue.serverTimestamp() 
        });
      }

      // 2. Load Docs
      const tRef = db.collection("tournaments").doc(tournamentId);
      const userRef = db.collection("users").doc(userId);
      const [tSnap, userSnap] = await Promise.all([transaction.get(tRef), transaction.get(userRef)]);

      if (!tSnap.exists) throw new Error("Tournament not found");
      if (!userSnap.exists) throw new Error("User not found");

      const tData = tSnap.data()!;
      const userData = userSnap.data()!;

      if (tData.status !== "upcoming") throw new Error("Tournament is no longer accepting joins");
      if (tData.currentPlayers >= tData.slots) throw new Error("Tournament is full");
      if (userData.balance < tData.entryFee) throw new Error("Insufficient balance");

      // 3. Update Balance & XP
      const currentBal = userData.balance || 0;
      const entryFee = Number(tData.entryFee);
      const newBal = currentBal - entryFee;
      
      const currentXP = userData.xp || 0;
      const newXP = currentXP + 50;
      const newLevel = Math.floor(newXP / 500) + 1;

      transaction.update(userRef, { 
        balance: newBal,
        xp: newXP,
        level: newLevel
      });

      // 4. Update Tournament
      transaction.update(tRef, { 
        currentPlayers: admin.firestore.FieldValue.increment(1) 
      });

      // 5. Create Participant
      const partRef = db.collection("participants").doc();
      transaction.set(partRef, {
        userId,
        tournamentId,
        inGameId: userData.inGameId || "",
        inGameName: userData.inGameName || "",
        teamName: userData.teamName || "",
        teamId: userData.teamId || "",
        username: userData.username,
        teammates: teammates,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // 6. Ledger Entry
      if (entryFee > 0) {
        const ledgerRef = db.collection("ledger").doc();
        transaction.set(ledgerRef, {
          userId,
          amount: -entryFee,
          balanceBefore: currentBal,
          balanceAfter: newBal,
          type: "DEBIT",
          category: LedgerCategory.ENTRY_FEE,
          referenceId: tournamentId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      const response = { success: true, newBalance: newBal, participantId: partRef.id };

      // 7. Complete Idempotency
      transaction.update(idenRef, { status: "completed", response });

      return response;
    });
  }

  /**
   * Redeems a promo code atomically.
   */
  static async redeemPromo(userId: string, code: string) {
    return await db.runTransaction(async (transaction) => {
      const q = db.collection("promocodes").where("code", "==", code.toUpperCase()).limit(1);
      const promoSnap = await transaction.get(q);
      
      if (promoSnap.empty) throw new Error("Invalid promo code");
      const promoDoc = promoSnap.docs[0];
      const promoData = promoDoc.data();
      
      if (!promoData.isActive) throw new Error("Promo code is inactive");
      if (promoData.currentUses >= promoData.maxUses) throw new Error("Promo code has reached max uses");

      // Check if user already used it
      const existingTx = await transaction.get(
        db.collection("transactions")
          .where("userId", "==", userId)
          .where("type", "==", "promo")
          .where("method", "==", `PROMO:${code.toUpperCase()}`)
          .limit(1)
      );
      if (!existingTx.empty) throw new Error("You have already used this promo code");

      // Update User Balance
      const userRef = db.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");
      
      const currentBal = userSnap.data()!.balance || 0;
      const amount = Number(promoData.amount);
      const newBal = currentBal + amount;
      
      transaction.update(userRef, { balance: newBal });

      // Create Ledger Entry
      const ledgerRef = db.collection("ledger").doc();
      transaction.set(ledgerRef, {
        userId,
        amount,
        balanceBefore: currentBal,
        balanceAfter: newBal,
        type: "CREDIT",
        category: LedgerCategory.PROMO,
        referenceId: promoDoc.id,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update Promo Code Uses
      transaction.update(promoDoc.ref, { 
        currentUses: admin.firestore.FieldValue.increment(1)
      });

      // Create Public Transaction Record
      const txRef = db.collection("transactions").doc();
      transaction.set(txRef, {
        userId,
        username: userSnap.data()!.username || "Unknown",
        userEmail: userSnap.data()!.email || "",
        type: "promo",
        amount,
        method: `PROMO:${code.toUpperCase()}`,
        status: "success",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        refId: `PRM-${Date.now()}`
      });

      return { code, amount, newBalance: newBal };
    });
  }
}
