import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Tournament } from '../types';
import { NotificationService } from '../services/NotificationService';

const NotificationContext = createContext({});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifiedTournaments, setNotifiedTournaments] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user) return;

        // Listen for tournament status changes to notify participants
        // This is a backup to the manual "GO LIVE" trigger in case multiple organizers exist
        const unsubTournaments = onSnapshot(collection(db, 'tournaments'), async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'modified') {
                    const t = { id: change.doc.id, ...change.doc.data() } as Tournament;
                    const oldData = change.doc.data(); // This doesn't give us "old" data easily in Firestore client SDK without a separate state
                    
                    // If status changed to live, check if current user is a participant
                    if (t.status === 'live') {
                        const pSnap = await getDocs(query(
                            collection(db, 'participants'),
                            where('tournamentId', '==', t.id),
                            where('userId', '==', user.uid)
                        ));
                        
                        if (!pSnap.empty && !notifiedTournaments.has(t.id + '_live')) {
                            // We don't create a persistent notification here because the Organizer already did
                            // But we could show a local toast if we had a toast system accessible here
                            setNotifiedTournaments(prev => new Set(prev).add(t.id + '_live'));
                        }
                    }
                }
            });
        });

        // Check for upcoming tournaments every 5 minutes
        const checkUpcoming = async () => {
            const now = new Date();
            const thirtyMinsLater = new Date(now.getTime() + 30 * 60000);
            
            const partSnap = await getDocs(query(collection(db, 'participants'), where('userId', '==', user.uid)));
            const tourIds = partSnap.docs.map(d => d.data().tournamentId);
            
            for (const id of tourIds) {
                if (notifiedTournaments.has(id + '_upcoming')) continue;
                
                const tDoc = await getDocs(query(collection(db, 'tournaments'), where('id', '==', id)));
                if (!tDoc.empty) {
                    const t = tDoc.docs[0].data() as Tournament;
                    const startTime = t.startTime instanceof Timestamp ? t.startTime.toDate() : new Date(t.startTime);
                    
                    if (startTime > now && startTime <= thirtyMinsLater && t.status === 'upcoming') {
                        await NotificationService.create(
                            user.uid,
                            'Upcoming Tournament!',
                            `${t.title} is starting in less than 30 minutes. Get ready!`,
                            'warning',
                            `/details/${t.id}`
                        );
                        setNotifiedTournaments(prev => new Set(prev).add(id + '_upcoming'));
                    }
                }
            }
        };

        checkUpcoming();
        const interval = setInterval(checkUpcoming, 5 * 60000);

        return () => {
            unsubTournaments();
            clearInterval(interval);
        };
    }, [user, notifiedTournaments]);

    return (
        <NotificationContext.Provider value={{}}>
            {children}
        </NotificationContext.Provider>
    );
};
