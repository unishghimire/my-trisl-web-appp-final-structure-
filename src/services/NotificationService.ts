import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification } from '../types';

export const NotificationService = {
    // Create a new notification for a user
    create: async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert' = 'info', link?: string) => {
        try {
            await addDoc(collection(db, 'notifications'), {
                userId,
                title,
                message,
                type,
                read: false,
                link,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error creating notification:", error);
        }
    },

    // Mark a notification as read
    markAsRead: async (notificationId: string) => {
        try {
            const ref = doc(db, 'notifications', notificationId);
            await updateDoc(ref, { read: true });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    },

    // Mark all notifications as read for a user
    markAllAsRead: async (userId: string) => {
        try {
            const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
            const snap = await getDocs(q);
            const promises = snap.docs.map(d => updateDoc(d.ref, { read: true }));
            await Promise.all(promises);
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
        }
    },

    // Listen for unread notifications for a user
    onUnreadCount: (userId: string, callback: (count: number) => void) => {
        const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.size);
        }, (error) => {
            console.error("Error in onUnreadCount snapshot:", error);
        });
    },

    // Listen for all notifications for a user
    onNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            callback(notifications);
        }, (error) => {
            console.error("Error in onNotifications snapshot:", error);
        });
    },

    // Notify all participants of a tournament
    notifyParticipants: async (tournamentId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert' = 'info', link?: string) => {
        try {
            const q = query(collection(db, 'participants'), where('tournamentId', '==', tournamentId));
            const snap = await getDocs(q);
            const promises = snap.docs.map(d => {
                const p = d.data();
                return addDoc(collection(db, 'notifications'), {
                    userId: p.userId,
                    title,
                    message,
                    type,
                    read: false,
                    link,
                    timestamp: serverTimestamp()
                });
            });
            await Promise.all(promises);
        } catch (error) {
            console.error("Error notifying participants:", error);
        }
    }
};
