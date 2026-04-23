import { auth } from '../firebase';
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

const app = getApp();
const functions = getFunctions(app);

export const walletApiService = {
  /**
   * Manual deposit (Admin only)
   */
  async manualDeposit(targetUserId: string, amount: number, referenceId?: string) {
    const adminAdjustBalanceFunc = httpsCallable(functions, "adminAdjustBalance");
    const result = await adminAdjustBalanceFunc({ targetUserId, amount, referenceId });
    return result.data as any;
  },

  /**
   * Approve deposit or withdrawal (Admin only)
   */
  async approveTransaction(transactionId: string) {
    const adminApproveTransaction = httpsCallable(functions, "adminApproveTransaction");
    const result = await adminApproveTransaction({ transactionId });
    return result.data as any;
  },

  /**
   * Reject withdrawal (Admin only)
   */
  async rejectTransaction(transactionId: string, reason: string) {
    const adminRejectTransaction = httpsCallable(functions, "adminRejectTransaction");
    const result = await adminRejectTransaction({ transactionId, reason });
    return result.data as any;
  },

  /**
   * Refund a successful transaction (Admin only)
   */
  async refundTransaction(transactionId: string) {
    throw new Error("Generic transaction refund not implemented for V2.");
  },

  /**
   * Redeem a promo code
   */
  async redeemPromo(code: string) {
    // Note: Redeem Promo is missing entirely from V2 handlers, adding a placeholder
    throw new Error("Redeem promo is migrating to V2. Please try again later.");
  },

  /**
   * Request withdrawal
   */
  async requestWithdrawal(amount: number, method: string, accountDetails: string) {
    const requestWithdrawalFunc = httpsCallable(functions, "requestWithdrawal");
    const result = await requestWithdrawalFunc({ amount, method, address: accountDetails });
    return result.data as any;
  },

  /**
   * Join Tournament and pay entry fee
   */
  async joinTournament(tournamentId: string, teammates: string[] = []) {
    const joinTournamentFunc = httpsCallable(functions, "joinTournament");
    const result = await joinTournamentFunc({ tournamentId, teammates });
    return result.data as any;
  },

  /**
   * Finalize tournament (Admin/Org only)
   */
  async finalizeTournament(tournamentId: string, winners: { userId: string, prize: number }[]) {
     throw new Error("Tournament finalization in V2 happens securely by updating {status: 'completed'} on the Tournament document directly.");
  }
};
