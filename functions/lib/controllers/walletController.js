"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestWithdrawal = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("../utils/auth");
const validation_1 = require("../utils/validation");
const WithdrawalService_1 = require("../services/WithdrawalService");
const errorHandler_1 = require("../utils/errorHandler");
/**
 * requestWithdrawal - Secure withdrawal processing to prevent double spending
 * Locks funds immediately.
 */
exports.requestWithdrawal = (0, https_1.onCall)(async (request) => {
    try {
        const uid = (0, auth_1.requireAuth)(request.auth);
        (0, validation_1.validateInput)(request.data, ["amount", "method", "address"]);
        const amount = (0, validation_1.validateAmount)(request.data.amount);
        const { method, address } = request.data;
        const result = await WithdrawalService_1.WithdrawalService.requestWithdrawal(uid, amount, method, address);
        return result;
    }
    catch (error) {
        (0, errorHandler_1.handleError)(error);
    }
});
//# sourceMappingURL=walletController.js.map