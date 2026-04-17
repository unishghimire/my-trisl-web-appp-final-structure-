import { db, admin } from "../db";
import { WalletService } from "./wallet.service";
import { LedgerCategory } from "../types";

export class TournamentService {
  /**
   * Finalizes a tournament, distributes prizes to winners, 
   * and processes the organizer revenue split.
   */
  static async finalizeTournament(tournamentId: string,WinnersList: { userId: string, prize: number }[], adminId: string) {
    return await db.runTransaction(async (transaction) => {
      const tournRef = db.collection("tournaments").doc(tournamentId);
      const tournSnap = await transaction.get(tournRef);
      
      if (!tournSnap.exists) throw new Error("Tournament not found");
      const tournData = tournSnap.data()!;
      
      if (tournData.status === "completed") throw new Error("Tournament already finalized");

      // 1. Calculate total revenue collected (Entry Fees)
      // This is dynamic, but for safety we should check participant count
      const totalEntryFees = (tournData.entryFee || 0) * (tournData.currentPlayers || 0);
      
      // 2. Distribute Prizes (50/50 model usually means Prize Pool is 50% of revenue, 
      // or Organizer gets 50% of leftover revenue).
      // Here we'll implement 50/50 Split of "Profit" or a fixed model.
      // Let's assume the Prize Pool was fixed, and any surplus entry fees are split 50/50 between Admin/Platform and Organizer.
      
      const prizePool = tournData.prizePool || 0;
      const profit = totalEntryFees - prizePool;
      const organizerShare = profit > 0 ? profit * 0.5 : 0;

      // 3. Mark Tournament as Completed
      transaction.update(tournRef, { 
        status: "completed", 
        finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
        finalizedBy: adminId
      });

      // 4. Queue the payouts (We will return the plans and execute them)
      // We can't use WalletService.credit INSIDE another transaction easily 
      // if it tries to spawn its own transaction. 
      // Instead, we perform the logic here.
      
      const payoutResults = [];

      // Payout Winners
      for (const winner of WinnersList) {
        const userRef = db.collection("users").doc(winner.userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) continue;
        
        const currentBal = userSnap.data()!.balance || 0;
        const currentEarn = userSnap.data()!.totalEarnings || 0;
        const newBal = currentBal + winner.prize;
        
        transaction.update(userRef, { 
           balance: newBal, 
           totalEarnings: currentEarn + winner.prize 
        });

        const ledgerRef = db.collection("ledger").doc();
        transaction.set(ledgerRef, {
          userId: winner.userId,
          amount: winner.prize,
          balanceBefore: currentBal,
          balanceAfter: newBal,
          type: "CREDIT",
          category: LedgerCategory.PRIZE,
          referenceId: tournamentId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Payout Organizer (if profit split exists)
      if (organizerShare > 0) {
        const orgRef = db.collection("users").doc(tournData.hostUid);
        const orgSnap = await transaction.get(orgRef);
        if (orgSnap.exists) {
          const currentBal = orgSnap.data()!.balance || 0;
          const newBal = currentBal + organizerShare;
          
          transaction.update(orgRef, { balance: newBal });
          
          const ledgerRef = db.collection("ledger").doc();
          transaction.set(ledgerRef, {
            userId: tournData.hostUid,
            amount: organizerShare,
            balanceBefore: currentBal,
            balanceAfter: newBal,
            type: "CREDIT",
            category: LedgerCategory.ORGANIZER_SHARE,
            referenceId: tournamentId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      return {
        tournamentId,
        totalRevenue: totalEntryFees,
        totalPrizes: prizePool,
        totalProfit: profit,
        organizerShare
      };
    });
  }
}
