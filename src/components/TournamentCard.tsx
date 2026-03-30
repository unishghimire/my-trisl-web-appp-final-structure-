import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tournament } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Clock, Users } from 'lucide-react';

interface TournamentCardProps {
    tournament: Tournament;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
    const navigate = useNavigate();
    const bgStyle = tournament.bannerUrl ? { backgroundImage: `url('${tournament.bannerUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: '#1f2937' };

    return (
        <div className="game-card bg-card rounded-xl overflow-hidden shadow-lg border border-gray-800 transition cursor-pointer group flex flex-col h-full" onClick={() => navigate(`/details/${tournament.id}`)}>
            <div className="h-32 relative overflow-hidden" style={bgStyle}>
                {!tournament.bannerUrl ? (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent z-10"></div>
                        <div className="absolute inset-0 bg-brand-900/20 group-hover:bg-brand-900/40 transition z-0"></div>
                    </>
                ) : (
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition"></div>
                )}
                <div className="absolute bottom-3 left-4 z-20">
                    <div className="font-bold text-lg text-white shadow-black drop-shadow-md group-hover:text-brand-300 transition leading-tight">{tournament.title}</div>
                </div>
                <div className="absolute top-3 right-3 z-20 flex gap-2">
                    <span className="bg-black/60 backdrop-blur-sm px-2 py-1 text-[10px] uppercase font-bold rounded text-white border border-white/10">{tournament.game}</span>
                </div>
            </div>
            <div className="p-4 flex-grow flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Prize Pool</div>
                        <div className="font-bold text-brand-400 text-lg">{formatCurrency(tournament.prizePool)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Entry</div>
                        <div className={`font-bold ${tournament.entryFee === 0 ? 'text-green-400' : 'text-white'}`}>{tournament.entryFee === 0 ? 'FREE' : formatCurrency(tournament.entryFee)}</div>
                    </div>
                </div>
                {tournament.status === 'completed' ? (
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/details/${tournament.id}`); }} className="w-full mt-3 py-2 bg-blue-600/20 border border-blue-600 text-blue-400 text-xs font-bold rounded hover:bg-blue-600 hover:text-white transition uppercase">View Results</button>
                ) : (
                    <div className="flex justify-between items-center text-xs mt-auto pt-3 border-t border-gray-700/50">
                        <div className="flex items-center text-gray-400">
                            <Clock className="w-3 h-3 mr-1" /> {formatDate(tournament.startTime).split(',')[0]}
                        </div>
                        <div className="flex items-center text-gray-400">
                            <Users className="w-3 h-3 mr-1" /> {tournament.currentPlayers}/{tournament.slots} Joined
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TournamentCard;
