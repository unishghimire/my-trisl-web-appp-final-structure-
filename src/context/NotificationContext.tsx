import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Tournament } from '../types';
import { NotificationService } from '../services/NotificationService';
import { X } from 'lucide-react';

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

interface NotificationContextType {
    showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const NotificationContext = createContext<NotificationContextType>({
    showToast: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifiedTournaments, setNotifiedTournaments] = useState<Set<string>>(new Set());
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

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
        <NotificationContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div 
                        key={toast.id} 
                        className={`pointer-events-auto min-w-[280px] p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-slide-in-right ${
                            toast.type === 'success' ? 'bg-green-900/90 border-green-500/50 text-green-100' :
                            toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-100' :
                            toast.type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50 text-yellow-100' :
                            'bg-gray-900/90 border-gray-700/50 text-gray-100'
                        }`}
                    >
                        <div className="flex-grow font-bold text-sm">{toast.message}</div>
                        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="opacity-50 hover:opacity-100">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};
