// --- FRONTEND USAGE EXAMPLES ---
// To use the refactored Cloud Functions in your frontend, use the Firebase Functions SDK.

import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

// Initialize functions instance
const app = getApp();
// Depending on region, you might need to specify: getFunctions(app, "us-central1")
const functions = getFunctions(app);

/**
 * Join Tournament Example
 */
export async function joinTournament(tournamentId: string, teammates: string[] = []) {
  const joinTournamentFunc = httpsCallable(functions, "joinTournament");
  try {
    const result = await joinTournamentFunc({ tournamentId, teammates });
    console.log("Successfully joined tournament:", result.data);
    return result.data;
  } catch (error: any) {
    console.error("Failed to join tournament:", error.message);
    // Display error.message to the user (e.g., "Insufficient balance")
    throw error;
  }
}

/**
 * Request Withdrawal Example
 */
export async function requestWithdrawal(amount: number, method: string, address: string) {
  const requestWithdrawalFunc = httpsCallable(functions, "requestWithdrawal");
  try {
    const result = await requestWithdrawalFunc({ amount, method, address });
    console.log("Withdrawal requested successfully:", result.data);
    return result.data;
  } catch (error: any) {
    console.error("Withdrawal error:", error.message);
    throw error;
  }
}

/**
 * Admin: Approve Withdrawal Example
 */
export async function adminApproveWithdrawal(withdrawalId: string, txHash: string) {
  const func = httpsCallable(functions, "adminApproveWithdrawal");
  try {
    const result = await func({ withdrawalId, txHash });
    console.log("Withdrawal approved:", result.data);
    return result.data;
  } catch (error) {
    console.error("Admin approval error:", error);
    throw error;
  }
}

/**
 * Note on Revenues & Refunds:
 * 
 * 1. Revenue splitting automatically triggers when you update a tournament's status to "completed" in Firestore.
 * 2. To update tournament status:
 *    - In an Admin panel, update `{ status: "completed" }` on the Tournament doc.
 *    - The `onTournamentStatusChanged` trigger catches this and automatically processes logic.
 */
