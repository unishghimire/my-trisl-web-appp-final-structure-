import { HttpsError } from "firebase-functions/v2/https";

export const handleError = (error: unknown, defaultMessage: string = "Internal Server Error"): never => {
  console.error("🔥 Cloud Function Error:", error);
  if (error instanceof HttpsError) {
    throw error;
  }
  if (error instanceof Error) {
    throw new HttpsError("internal", error.message);
  }
  throw new HttpsError("internal", defaultMessage);
};
