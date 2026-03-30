import React from 'react';
import { Game } from '../types';
import { motion } from 'motion/react';

interface GameCardProps {
    game: Game;
}

const GameCard: React.FC<GameCardProps> = ({ game }) => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className="bg-card rounded-xl overflow-hidden border border-gray-800 hover:border-brand-500/50 transition-all group shadow-lg"
        >
            <div className="relative h-48 overflow-hidden">
                <img 
                    src={game.logoUrl || 'https://picsum.photos/seed/gaming/400/300'} 
                    alt={game.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-4 left-4">
                    <h3 className="text-xl font-bold text-white drop-shadow-md">{game.name}</h3>
                </div>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                    {game.modes.map((mode, idx) => (
                        <span 
                            key={idx} 
                            className="px-2 py-1 bg-surface text-brand-400 text-[10px] font-bold uppercase rounded border border-brand-500/20"
                        >
                            {mode}
                        </span>
                    ))}
                </div>
                <div className="pt-2 border-t border-gray-800 flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-mono uppercase">Available Modes: {game.modes.length}</span>
                    <button className="text-xs font-bold text-brand-500 hover:text-brand-400 uppercase tracking-wider transition">Explore</button>
                </div>
            </div>
        </motion.div>
    );
};

export default GameCard;
