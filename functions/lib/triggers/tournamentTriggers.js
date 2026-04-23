"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onTournamentStatusChanged = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const RevenueService_1 = require("../services/RevenueService");
/**
 * Triggered when a tournament document is updated.
 * Automatically calculate revenue to split between NexPlay and Organizer.
 */
exports.onTournamentStatusChanged = (0, firestore_1.onDocumentUpdated)("tournaments/{tournamentId}", async (event) => {
    var _a, _b;
    const dataBefore = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const dataAfter = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!dataBefore || !dataAfter)
        return;
    // Check if status changed to 'completed'
    if (dataBefore.status !== "completed" && dataAfter.status === "completed") {
        try {
            console.log(`Tournament ${event.params.tournamentId} marked completed. Calculating revenue split.`);
            await RevenueService_1.RevenueService.calculateAndSplitRevenue(event.params.tournamentId);
        }
        catch (error) {
            console.error(`Failed to calculate revenue for tournament ${event.params.tournamentId}:`, error);
            // Depending on severity, throw or alert monitoring system
        }
    }
});
//# sourceMappingURL=tournamentTriggers.js.map