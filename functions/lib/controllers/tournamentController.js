"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinTournament = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const auth_1 = require("../utils/auth");
const validation_1 = require("../utils/validation");
const WalletService_1 = require("../services/WalletService");
const errorHandler_1 = require("../utils/errorHandler");
/**
 * joinTournament - Securely allows a user to register for a tournament.
 * Enforces server-side checks for everything.
 */
exports.joinTournament = (0, https_1.onCall)(async (request) => {
    try {
        const uid = (0, auth_1.requireAuth)(request.auth);
        (0, validation_1.validateInput)(request.data, ["tournamentId"]);
        const { tournamentId, teammates = [] } = request.data;
        const db = admin.firestore();
        return await db.runTransaction(async (t) => {
            const tRef = db.collection("tournaments").doc(tournamentId);
            const userRef = db.collection("users").doc(uid);
            const [tSnap, userSnap] = await Promise.all([t.get(tRef), t.get(userRef)]);
            if (!tSnap.exists)
                throw new https_1.HttpsError("not-found", "Tournament not found");
            if (!userSnap.exists)
                throw new https_1.HttpsError("not-found", "User not found");
            const tData = tSnap.data();
            const userData = userSnap.data();
            // Validations
            if (tData.status !== "upcoming")
                throw new https_1.HttpsError("failed-precondition", "Tournament is not open for registration.");
            if (tData.currentPlayers >= tData.slots)
                throw new https_1.HttpsError("failed-precondition", "Tournament is full.");
            // Check if already registered
            const currentParticipants = await t.get(db.collection("participants").where("tournamentId", "==", tournamentId).where("userId", "==", uid));
            if (!currentParticipants.empty) {
                throw new https_1.HttpsError("already-exists", "User is already registered for this tournament.");
            }
            const entryFee = Number(tData.entryFee || 0);
            // Deduct fee and generate atomic state
            if (entryFee > 0) {
                await WalletService_1.WalletService.deductFunds(uid, entryFee, tournamentId, { type: "TOURNAMENT_ENTRY" }, t);
            }
            // Add Participant
            const partRef = db.collection("participants").doc();
            t.set(partRef, {
                userId: uid,
                tournamentId,
                username: userData.username,
                inGameId: userData.inGameId || "",
                teammates,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            // Increment players
            t.update(tRef, { currentPlayers: admin.firestore.FieldValue.increment(1) });
            return { success: true, participantId: partRef.id };
        });
    }
    catch (error) {
        (0, errorHandler_1.handleError)(error);
    }
});
//# sourceMappingURL=tournamentController.js.map