import { Router } from "express";
import { WalletController } from "./controllers/wallet.controller";
import { TournamentController } from "./controllers/tournament.controller";
import { authenticate, adminOnly, organizerOrAdmin } from "./middleware/auth.middleware";

const router = Router();

// Wallet Routes
router.post("/wallet/deposit", authenticate, adminOnly, WalletController.manualDeposit);
router.post("/wallet/withdraw", authenticate, WalletController.requestWithdrawal);
router.post("/wallet/approve", authenticate, adminOnly, WalletController.approve);
router.post("/wallet/reject", authenticate, adminOnly, WalletController.reject);
router.post("/wallet/refund", authenticate, adminOnly, WalletController.refund);
router.post("/wallet/promo/redeem", authenticate, WalletController.redeemPromo);
router.post("/wallet/join", authenticate, WalletController.joinTournament);

// Tournament Routes
router.post("/tournaments/finalize", authenticate, organizerOrAdmin, TournamentController.finalize);

export default router;
