import * as admin from "firebase-admin";

admin.initializeApp();

// Export controllers (HTTPS Callable Functions)
export * from "./controllers/tournamentController";
export * from "./controllers/walletController";
export * from "./controllers/adminController";

// Export triggers (Firestore Background Functions)
export * from "./triggers/tournamentTriggers";
export * from "./triggers/paymentTriggers";
