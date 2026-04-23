"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = void 0;
const https_1 = require("firebase-functions/v2/https");
const handleError = (error, defaultMessage = "Internal Server Error") => {
    console.error("🔥 Cloud Function Error:", error);
    if (error instanceof https_1.HttpsError) {
        throw error;
    }
    if (error instanceof Error) {
        throw new https_1.HttpsError("internal", error.message);
    }
    throw new https_1.HttpsError("internal", defaultMessage);
};
exports.handleError = handleError;
//# sourceMappingURL=errorHandler.js.map