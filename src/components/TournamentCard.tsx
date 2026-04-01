import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tournament } from '../types';
import { DEFAULT_BANNER } from '../constants';
import { formatCurrency, formatDate } from '../utils';
import { Clock, Users, Trophy, ChevronRight, Gamepad2, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

interface TournamentCardProps {
    tournament: Tournament;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
    const navigate = useNavigate();
    const bannerUrl = tournament.bannerUrl || DEFAULT_BANNER;

    return (
        <motion.div 
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="group relative bg-surface rounded-[2rem] overflow-hidden border border-gray-800/50 hover:border-brand-500/50 transition-all duration-500 cursor-pointer flex flex-col h-full shadow-2xl hover:shadow-brand-500/20"
            onClick={() => navigate(`/details/${tournament.id}`)}
        >
            {/* Banner Section */}
            <div className="h-48 relative overflow-hidden">
                <motion.img 
                    src={bannerUrl} 
                    alt={tournament.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent z-10"></div>
                
                {/* Status & Game Badges */}
                <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">
                    <div className="bg-brand-600/90 backdrop-blur-md px-3 py-1 text-[10px] uppercase font-black rounded-full text-white border border-brand-500/30 tracking-widest shadow-xl flex items-center gap-1.5">
                        <Gamepad2 className="w-3 h-3" />
                        {tournament.game}
                    </div>
                    <div className={`backdrop-blur-md px-3 py-1 text-[10px] uppercase font-black rounded-full text-white border tracking-widest shadow-xl flex items-center gap-1.5 ${
                        tournament.status === 'live' ? 'bg-red-600/90 border-red-500/30 animate-pulse' : 
                        tournament.status === 'completed' ? 'bg-blue-600/90 border-blue-500/30' : 
                        'bg-green-600/90 border-green-500/30'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tournament.status === 'live' ? 'bg-white' : 'bg-current'}`}></span>
                        {tournament.status}
                    </div>
                </div>

                {/* Team Size Badge - Floating Right */}
                <div className="absolute top-4 right-4 z-20">
                    <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-white uppercase tracking-widest">
                        {tournament.teamType}
                    </div>
                </div>

                {/* Prize Pool - Large Overlay */}
                <div className="absolute bottom-4 left-4 z-20">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-0.5">Prize Pool</span>
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                            <span className="text-2xl font-black text-white tracking-tighter drop-shadow-lg">
                                {formatCurrency(tournament.prizePool)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-6 flex-grow flex flex-col bg-gradient-to-b from-surface to-dark/50">
                <h3 className="text-xl font-black text-white mb-4 group-hover:text-brand-400 transition-colors line-clamp-1 uppercase tracking-tight leading-tight">
                    {tournament.title}
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-dark/40 p-3 rounded-2xl border border-gray-800/50 group-hover:border-brand-500/20 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-3.5 h-3.5 text-brand-500" />
                            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Format</span>
                        </div>
                        <div className="text-xs text-gray-200 font-black truncate uppercase tracking-tight">
                            {tournament.teamType} • {tournament.type}
                        </div>
                    </div>
                    <div className="bg-dark/40 p-3 rounded-2xl border border-gray-800/50 group-hover:border-brand-500/20 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-brand-500" />
                            <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Map</span>
                        </div>
                        <div className="text-xs text-gray-200 font-black truncate uppercase tracking-tight">
                            {tournament.map || 'TBD'}
                        </div>
                    </div>
                </div>

                <div className="space-y-4 mt-auto">
                    {/* Progress Section */}
                    <div className="bg-dark/20 p-4 rounded-2xl border border-gray-800/30">
                        <div className="flex justify-between items-end mb-2">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Entry Fee</span>
                                <span className={`text-sm font-black ${tournament.entryFee === 0 ? 'text-green-400' : 'text-white'}`}>
                                    {tournament.entryFee === 0 ? 'FREE' : formatCurrency(tournament.entryFee)}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest block mb-0.5">Slots</span>
                                <span className="text-sm font-black text-brand-400">{tournament.currentPlayers} / {tournament.slots}</span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-800/50">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(tournament.currentPlayers / tournament.slots) * 100}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className="bg-brand-600 h-full rounded-full relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                            </motion.div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2 text-gray-500">
                            <Clock className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {formatDate(tournament.startTime).split(',')[0]}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-brand-600/10 text-brand-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-brand-600 group-hover:text-white transition-all duration-300">
                            View Details <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default TournamentCard;
