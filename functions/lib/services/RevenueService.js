"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueService = void 0;
const admin = require("firebase-admin");
class RevenueService {
    static get db() {
        return admin.firestore();
    }
    /**
     * Calculates profits and splits revenue upon tournament completion.
     */
    static async calculateAndSplitRevenue(tournamentId) {
        return this.db.runTransaction(async (t) => {
            const tourneyRef = this.db.collection("tournaments").doc(tournamentId);
            const tourneyDoc = await t.get(tourneyRef);
            if (!tourneyDoc.exists)
                throw new Error("Tournament not found");
            const data = tourneyDoc.data();
            // Idempotency Check: Prevent duplicate earnings process
            const earningsRef = this.db.collection("tournamentEarnings").doc(tournamentId);
            const earningsDoc = await t.get(earningsRef);
            if (earningsDoc.exists) {
                console.log(`Earnings already split for tournament ${tournamentId}. Skipping.`);
                return earningsDoc.data();
            }
            const totalPlayers = data.currentPlayers || 0;
            const entryFee = data.entryFee || 0;
            const totalCollected = totalPlayers * entryFee;
            const totalPrizePool = data.prizePool || 0;
            const totalProfit = totalCollected - totalPrizePool;
            // Ensure platform doesn't hit negatives theoretically if improperly configured
            const safeProfit = Math.max(0, totalProfit);
            // Split
            const orgSharePercentage = data.orgSharePercentage || 0.8; // default 80% to org
            const orgShare = safeProfit * orgSharePercentage;
            const platformShare = safeProfit - orgShare;
            const earningsData = {
                tournamentId,
                orgId: data.orgId || "NEXPLAY_INTERNAL",
                totalCollected,
                totalPrizePool,
                totalProfit: safeProfit,
                orgShare,
                platformShare,
                status: "pending", // must be released by Admin
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            t.set(earningsRef, earningsData);
            // Audit Log
            const auditRef = this.db.collection("auditLogs").doc();
            t.set(auditRef, {
                action: "REVENUE_SPLIT",
                tournamentId,
                totalProfit: safeProfit,
                status: "SUCCESS",
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            return earningsData;
        });
    }
}
exports.RevenueService = RevenueService;
//# sourceMappingURL=RevenueService.js.map