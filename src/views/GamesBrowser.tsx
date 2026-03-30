import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Game } from '../types';
import GameCard from '../components/GameCard';
import { Search, Filter, Gamepad2 } from 'lucide-react';
import { motion } from 'motion/react';

const GamesBrowser: React.FC = () => {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMode, setSelectedMode] = useState('all');

    useEffect(() => {
        const fetchGames = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'games'), 
                    where('isPublished', '==', true),
                    orderBy('createdAt', 'desc')
                );
                const snap = await getDocs(q);
                setGames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game)));
            } catch (error) {
                console.error("Error fetching games:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGames();
    }, []);

    const allModes = Array.from(new Set(games.flatMap(g => g.modes)));

    const filteredGames = games.filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMode = selectedMode === 'all' || g.modes.includes(selectedMode);
        return matchesSearch && matchesMode;
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono tracking-widest uppercase">Initializing Game Matrix...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <Gamepad2 className="text-brand-500 w-10 h-10" />
                        Explore Games
                    </h1>
                    <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Discover your next battlefield</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="relative flex-grow sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Search games..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-card border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white focus:border-brand-500 outline-none transition-all shadow-inner"
                        />
                    </div>
                    <div className="relative sm:w-48">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <select 
                            value={selectedMode}
                            onChange={(e) => setSelectedMode(e.target.value)}
                            className="w-full bg-card border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white focus:border-brand-500 outline-none transition-all shadow-inner appearance-none cursor-pointer"
                        >
                            <option value="all">All Modes</option>
                            {allModes.map(mode => (
                                <option key={mode} value={mode}>{mode}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredGames.length > 0 ? (
                    filteredGames.map(game => (
                        <GameCard key={game.id} game={game} />
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center space-y-4">
                        <div className="w-20 h-20 bg-card border border-gray-800 rounded-full flex items-center justify-center mx-auto text-gray-700">
                            <Gamepad2 className="w-10 h-10" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-white">No Games Found</h3>
                            <p className="text-gray-500 text-sm">Try adjusting your search or filters.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GamesBrowser;
