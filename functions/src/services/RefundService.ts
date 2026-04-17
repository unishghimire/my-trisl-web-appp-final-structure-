import * as admin from "firebase-admin";
import { WalletService } from "./WalletService";

export class RefundService {
  private static get db() {
    return admin.firestore();
  }

  /**
   * Mass refund for a cancelled tournament.
   */
  static async refundTournament(tournamentId: string, adminId: string) {
    const participantsSnap = await this.db.collection("participants")
      .where("tournamentId", "==", tournamentId)
      .get();
      
    if (participantsSnap.empty) {
      return { success: true, refundedCount: 0 };
    }

    const tourneyDoc = await this.db.collection("tournaments").doc(tournamentId).get();
    const entryFee = tourneyDoc.data()?.entryFee || 0;

    if (entryFee <= 0) {
      return { success: true, refundedCount: 0 };
    }

    let refundedCount = 0;
    const batchSize = 500;
    // For production, we'd use batched writes or limits if > 500, simplified here for size.

    for (const pSnap of participantsSnap.docs) {
      const pData = pSnap.data();
      const userId = pData.userId;
      
      try {
        await this.db.runTransaction(async (t) => {
          // Idempotency Check per user
          const refundRef = this.db.collection("refunds").doc(`${tournamentId}_${userId}`);
          const refundDoc = await t.get(refundRef);
          if (refundDoc.exists) return; // already refunded this user for this tourney

          await WalletService.addFunds(
            userId, 
            entryFee, 
            tournamentId, 
            "TOURNAMENT_REFUND", 
            { reason: "Tournament Cancelled", adminId },
            t
          );

          t.set(refundRef, {
            userId,
            tournamentId,
            amount: entryFee,
            adminId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          // Mark participant as refunded
          t.update(pSnap.ref, { status: "refunded" });
        });
        refundedCount++;
      } catch (err) {
        console.error(`Failed to refund user ${userId} for tourney ${tournamentId}:`, err);
      }
    }

    // Audit full process
    await this.db.collection("auditLogs").add({
      action: "MASS_REFUND",
      tournamentId,
      adminId,
      refundedCount,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, refundedCount };
  }
}
