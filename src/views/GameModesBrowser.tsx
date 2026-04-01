import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Game } from '../types';
import { Gamepad2, Layers, ChevronRight } from 'lucide-react';

const defaultImages = [
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80',
];

const getModeImage = (mode: string, index: number) => {
    const m = mode.toLowerCase();
    if (m.includes('clash') || m.includes('tdm') || m.includes('deathmatch')) {
        return 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80';
    }
    if (m.includes('lone') || m.includes('1v1') || m.includes('solo')) {
        return 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80';
    }
    if (m.includes('classic') || m.includes('battle') || m.includes('map')) {
        return 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80';
    }
    if (m.includes('rank')) {
        return 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80';
    }
    if (m.includes('arcade') || m.includes('fun')) {
        return 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80';
    }
    return defaultImages[index % defaultImages.length];
};
import { motion } from 'motion/react';

const GameModesBrowser: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGame = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const docRef = doc(db, 'games', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setGame({ id: docSnap.id, ...docSnap.data() } as Game);
                }
            } catch (error) {
                console.error("Error fetching game:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGame();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono tracking-widest uppercase">Loading Modes...</p>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <p className="text-gray-500 text-xl font-bold uppercase">Game not found</p>
                <button 
                    onClick={() => navigate('/games')}
                    className="mt-4 px-6 py-2 bg-brand-500 text-black font-bold uppercase rounded-lg hover:bg-brand-400 transition"
                >
                    Back to Games
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <img src={game.logoUrl || 'https://picsum.photos/seed/gaming/400/300'} alt={game.name} className="w-12 h-12 object-cover rounded-lg" referrerPolicy="no-referrer" />
                        {game.name} Modes
                    </h1>
                    <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Select a mode to view tournaments</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {game.modes && game.modes.length > 0 ? (
                    game.modes.map((mode, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ scale: 1.03, y: -5 }}
                            onClick={() => navigate(`/tournaments?game=${encodeURIComponent(game.name)}&mode=${encodeURIComponent(mode)}`)}
                            className="relative rounded-2xl overflow-hidden cursor-pointer group"
                        >
                            {/* Glowing background effect on hover */}
                            <div className="absolute inset-0 bg-brand-500/20 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
                            
                            <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-gray-800 group-hover:border-brand-500/50 transition-all duration-500 shadow-2xl">
                                <img 
                                    src={getModeImage(mode, idx)} 
                                    alt={mode} 
                                    className="w-full h-full object-cover group-hover:scale-110 group-hover:rotate-1 transition-transform duration-700 ease-out" 
                                    referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-500"></div>
                                
                                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-2xl font-black text-white group-hover:text-brand-400 transition-colors drop-shadow-lg uppercase tracking-tight">{mode}</h3>
                                        <div className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 group-hover:border-brand-500/50 group-hover:bg-brand-500/20 transition-all duration-300 transform group-hover:rotate-12">
                                            <Gamepad2 className="w-5 h-5 text-gray-300 group-hover:text-brand-400" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                        <span className="text-xs text-brand-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                            Explore Tournaments <ChevronRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center space-y-4">
                        <div className="w-20 h-20 bg-card border border-gray-800 rounded-full flex items-center justify-center mx-auto text-gray-700">
                            <Gamepad2 className="w-10 h-10" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-white uppercase">No Modes Found</h3>
                            <p className="text-gray-500 text-sm">This game currently has no active modes.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameModesBrowser;
