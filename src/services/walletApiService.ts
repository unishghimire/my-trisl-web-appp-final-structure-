import { auth } from '../firebase';

const API_BASE_URL = '/api/v2';

export const walletApiService = {
  /**
   * Helper to get common headers with Auth token
   */
  async getHeaders() {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  },

  /**
   * Manual deposit (Admin only)
   */
  async manualDeposit(targetUserId: string, amount: number, referenceId?: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/wallet/deposit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        targetUserId, 
        amount, 
        referenceId, 
        idempotencyKey: `deposit_${targetUserId}_${Date.now()}` 
      })
    });
    return response.json();
  },

  /**
   * Approve deposit (Admin only)
   */
  async approveTransaction(transactionId: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/wallet/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transactionId })
    });
    return response.json();
  },

  /**
   * Reject withdrawal (Admin only)
   */
  async rejectTransaction(transactionId: string, reason: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/wallet/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transactionId, reason })
    });
    return response.json();
  },

  /**
   * Refund a successful transaction (Admin only)
   */
  async refundTransaction(transactionId: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/wallet/refund`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transactionId })
    });
    return response.json();
  },

  /**
   * Redeem a promo code
   */
  async redeemPromo(code: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/wallet/promo/redeem`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code })
    });
    return response.json();
  },

  /**
   * Request withdrawal
   */
  async requestWithdrawal(amount: number, method: string, accountDetails: string) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/wallet/withdraw`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        amount, 
        method, 
        accountDetails, 
        idempotencyKey: `withdraw_${auth.currentUser?.uid}_${Date.now()}` 
      })
    });
    return response.json();
  },

  /**
   * Join Tournament and pay entry fee
   */
  async joinTournament(tournamentId: string, teammates: string[] = []) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/wallet/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        tournamentId, 
        teammates,
        idempotencyKey: `join_${tournamentId}_${auth.currentUser?.uid}_${Date.now()}` 
      })
    });
    return response.json();
  },

  /**
   * Finalize tournament (Admin/Org only)
   */
  async finalizeTournament(tournamentId: string, winners: { userId: string, prize: number }[]) {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_BASE_URL}/tournaments/finalize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        tournamentId, 
        winners 
      })
    });
    return response.json();
  }
};
