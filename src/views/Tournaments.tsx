import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament } from '../types';
import TournamentCard from '../components/TournamentCard';

const GAMES = ['PUBG Mobile', 'Free Fire', 'COD Mobile', 'Mobile Legends', 'Clash Royale'];

const Tournaments: React.FC = () => {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [gameFilter, setGameFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTournaments = async () => {
            setLoading(true);
            try {
                const snap = await getDocs(collection(db, 'tournaments'));
                let tours = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
                
                tours.sort((a, b) => {
                    if (a.status === 'live' && b.status !== 'live') return -1;
                    if (b.status === 'live' && a.status !== 'live') return 1;
                    return (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0);
                });

                setTournaments(tours);
            } catch (error) {
                console.error("Error fetching tournaments:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTournaments();
    }, []);

    const filteredTournaments = tournaments.filter(t => {
        const matchesGame = gameFilter === 'all' || t.game === gameFilter;
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        return matchesGame && matchesStatus;
    });

    const statusTabs = [
        { id: 'all', label: 'All' },
        { id: 'upcoming', label: 'Upcoming' },
        { id: 'live', label: 'Live Now' },
        { id: 'completed', label: 'Ended' }
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="loader mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono">ESTABLISHING UPLINK...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-white">All Tournaments</h2>
            </div>
            
            <div className="flex border-b border-gray-700 mb-6 overflow-x-auto">
                {statusTabs.map(s => (
                    <button 
                        key={s.id}
                        onClick={() => setStatusFilter(s.id)} 
                        className={`px-6 py-3 text-sm font-bold uppercase transition ${statusFilter === s.id ? 'text-white border-b-2 border-brand-500' : 'text-gray-400 hover:text-white'}`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <button 
                    onClick={() => setGameFilter('all')} 
                    className={`px-4 py-2 rounded-lg bg-card hover:bg-surface text-sm border border-gray-700 transition ${gameFilter === 'all' ? 'border-brand-500 text-brand-400' : 'text-gray-400'}`}
                >
                    All Games
                </button>
                {GAMES.map(g => (
                    <button 
                        key={g}
                        onClick={() => setGameFilter(g)} 
                        className={`px-4 py-2 rounded-lg bg-card hover:bg-surface text-sm border border-gray-700 transition ${gameFilter === g ? 'border-brand-500 text-brand-400' : 'text-gray-400'}`}
                    >
                        {g}
                    </button>
                ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[50vh]">
                {filteredTournaments.length > 0 ? (
                    filteredTournaments.map(t => <TournamentCard key={t.id} tournament={t} />)
                ) : (
                    <div className="col-span-full text-center text-gray-500 py-10">
                        No tournaments match this filter.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Tournaments;
