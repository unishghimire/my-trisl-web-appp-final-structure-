import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, Game } from '../types';
import TournamentCard from '../components/TournamentCard';
import { Filter, Search } from 'lucide-react';

const Tournaments: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [games, setGames] = useState<Game[]>([]);
    
    const [gameFilter, setGameFilter] = useState(searchParams.get('game') || 'all');
    const [modeFilter, setModeFilter] = useState(searchParams.get('mode') || 'all');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
    const [entryFilter, setEntryFilter] = useState(searchParams.get('entry') || 'all'); // 'all', 'free', 'paid'
    const [teamTypeFilter, setTeamTypeFilter] = useState(searchParams.get('teamType') || 'all'); // 'all', 'solo', 'duo', 'squad'
    
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [tournamentsSnap, gamesSnap] = await Promise.all([
                    getDocs(collection(db, 'tournaments')),
                    getDocs(collection(db, 'games'))
                ]);
                
                let tours = tournamentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
                
                tours.sort((a, b) => {
                    if (a.status === 'live' && b.status !== 'live') return -1;
                    if (b.status === 'live' && a.status !== 'live') return 1;
                    return (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0);
                });

                setTournaments(tours);
                setGames(gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game)));
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        if (gameFilter !== 'all') params.set('game', gameFilter);
        if (modeFilter !== 'all') params.set('mode', modeFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (entryFilter !== 'all') params.set('entry', entryFilter);
        if (teamTypeFilter !== 'all') params.set('teamType', teamTypeFilter);
        setSearchParams(params, { replace: true });
    }, [gameFilter, modeFilter, statusFilter, entryFilter, teamTypeFilter, setSearchParams]);

    const filteredTournaments = tournaments.filter(t => {
        const matchesGame = gameFilter === 'all' || t.game === gameFilter;
        const matchesMode = modeFilter === 'all' || t.type === modeFilter;
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        const matchesEntry = entryFilter === 'all' || (entryFilter === 'free' ? t.entryFee === 0 : t.entryFee > 0);
        const matchesTeamType = teamTypeFilter === 'all' || t.teamType === teamTypeFilter;
        
        return matchesGame && matchesMode && matchesStatus && matchesEntry && matchesTeamType;
    });

    const statusTabs = [
        { id: 'all', label: 'All' },
        { id: 'upcoming', label: 'Upcoming' },
        { id: 'live', label: 'Live Now' },
        { id: 'completed', label: 'Ended' }
    ];

    const selectedGameObj = games.find(g => g.name === gameFilter);
    const availableModes = selectedGameObj ? selectedGameObj.modes : Array.from(new Set(games.flatMap(g => g.modes)));

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
                <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
                    {gameFilter !== 'all' ? `${gameFilter} Tournaments` : 'All Tournaments'}
                    {modeFilter !== 'all' && <span className="text-brand-500 ml-2">({modeFilter})</span>}
                </h2>
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

            <div className="bg-dark/50 p-4 rounded-xl border border-gray-800 space-y-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <Filter className="w-4 h-4 text-brand-500" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Filters</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entry Type</label>
                        <select 
                            value={entryFilter}
                            onChange={(e) => setEntryFilter(e.target.value)}
                            className="w-full bg-card border border-gray-700 rounded-lg p-2 text-white focus:border-brand-500 outline-none transition text-sm"
                        >
                            <option value="all">All Types</option>
                            <option value="free">Free Entry</option>
                            <option value="paid">Paid Entry</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Player Quantity</label>
                        <select 
                            value={teamTypeFilter}
                            onChange={(e) => setTeamTypeFilter(e.target.value)}
                            className="w-full bg-card border border-gray-700 rounded-lg p-2 text-white focus:border-brand-500 outline-none transition text-sm"
                        >
                            <option value="all">All Sizes</option>
                            <option value="solo">Solo</option>
                            <option value="duo">Duo</option>
                            <option value="squad">Squad</option>
                        </select>
                    </div>
                </div>
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
