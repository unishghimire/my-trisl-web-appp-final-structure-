import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { RevenueService } from "../services/RevenueService";

/**
 * Triggered when a tournament document is updated.
 * Automatically calculate revenue to split between NexPlay and Organizer.
 */
export const onTournamentStatusChanged = onDocumentUpdated("tournaments/{tournamentId}", async (event) => {
  const dataBefore = event.data?.before.data();
  const dataAfter = event.data?.after.data();

  if (!dataBefore || !dataAfter) return;

  // Check if status changed to 'completed'
  if (dataBefore.status !== "completed" && dataAfter.status === "completed") {
    try {
      console.log(`Tournament ${event.params.tournamentId} marked completed. Calculating revenue split.`);
      await RevenueService.calculateAndSplitRevenue(event.params.tournamentId);
    } catch (error) {
      console.error(`Failed to calculate revenue for tournament ${event.params.tournamentId}:`, error);
      // Depending on severity, throw or alert monitoring system
    }
  }
});
