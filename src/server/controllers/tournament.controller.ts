import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { TournamentService } from "../services/tournament.service";
import { db, admin } from "../db";

export class TournamentController {
  /**
   * Finalizes a tournament and pays out winners.
   * Admin or Organizer only.
   */
  static async finalize(req: AuthenticatedRequest, res: Response) {
    try {
      const { tournamentId, winners } = req.body;
      const adminId = req.user!.userId;

      if (!tournamentId || !winners || !Array.isArray(winners)) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      const result = await TournamentService.finalizeTournament(tournamentId, winners, adminId);

      // Log action
      await db.collection("adminLogs").add({
        adminId,
        action: "FINALIZE_TOURNAMENT",
        targetId: tournamentId,
        details: `Finalized tournament ${tournamentId} with ${winners.length} winners`,
        metadata: { result },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, code: "TOURNAMENT_FINALIZE_FAILED" });
    }
  }
}
