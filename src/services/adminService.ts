import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust this import based on your actual firebase setup

/**
 * Admin script to add a dummy organization to the 'users_public' collection.
 * Run this from an admin-only component or console.
 */
export const addDummyOrganization = async (uid: string, username: string, orgName: string) => {
    try {
        const orgRef = doc(db, 'users_public', uid);
        await setDoc(orgRef, {
            role: 'organizer',
            username: username,
            orgName: orgName,
            profilePicture: 'https://picsum.photos/seed/org/200/200', // Example placeholder
            createdAt: new Date()
        });
        console.log(`Successfully added organization: ${orgName}`);
        return true;
    } catch (error) {
        console.error("Error adding organization:", error);
        return false;
    }
};
