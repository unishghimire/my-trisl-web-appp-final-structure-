import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

/**
 * Update the tournament participant count snapshot dynamically so we avoid heavy read queries count
 */
export const onParticipantAdd = onDocumentCreated("participants/{participantId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const data = snapshot.data();
  const tournamentId = data.tournamentId;
  if (!tournamentId) return;

  const db = admin.firestore();
  
  // Example of maintaining a fast-access snapshot collection for the UI
  // The actual count is already updated by joinTournament transaction, but this shows how cache could be managed.
  const cacheRef = db.collection("cache").doc(`tournaments_${tournamentId}`);
  await cacheRef.set({
    lastParticipantJoinedAt: admin.firestore.FieldValue.serverTimestamp(),
    recentJoiners: admin.firestore.FieldValue.arrayUnion(data.username || "Unknown")
  }, { merge: true });

});
