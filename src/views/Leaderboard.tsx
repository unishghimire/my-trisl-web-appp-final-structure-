import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Team } from '../types';
import { Trophy, Users, ArrowUp, ArrowDown, Minus, Star, Search, Filter, ChevronRight, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

const RankIndicator = ({ change }: { change?: number }) => {
    if (change === undefined || change === 0) return <Minus className="w-3 h-3 text-gray-600" />;
    if (change > 0) return (
        <div className="flex items-center text-green-500 gap-0.5">
            <ArrowUp className="w-3 h-3" />
            <span className="text-[10px] font-bold">{change}</span>
        </div>
    );
    return (
        <div className="flex items-center text-red-500 gap-0.5">
            <ArrowDown className="w-3 h-3" />
            <span className="text-[10px] font-bold">{Math.abs(change)}</span>
        </div>
    );
};

const PodiumCard = ({ item, rank, type, navigate }: { item: any, rank: number, type: 'player' | 'team', navigate: any }) => {
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    const isThird = rank === 3;
    
    const borderColor = isFirst ? 'border-yellow-500' : isSecond ? 'border-gray-400' : 'border-amber-700';
    const bgColor = isFirst ? 'from-yellow-500/20' : isSecond ? 'from-gray-400/20' : 'from-amber-700/20';
    const shadowColor = isFirst ? 'shadow-yellow-500/20' : isSecond ? 'shadow-gray-400/20' : 'shadow-amber-700/20';

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.1 }}
            onClick={() => navigate(type === 'player' ? `/user/${item.uid}` : `/team/${item.id}`)}
            className={`relative flex flex-col items-center p-6 rounded-3xl border ${borderColor} bg-gradient-to-b ${bgColor} to-transparent ${shadowColor} shadow-2xl cursor-pointer group hover:scale-105 transition-transform duration-300`}
        >
            {isFirst && (
                <div className="absolute -top-4 bg-yellow-500 text-black p-1.5 rounded-full shadow-lg z-10">
                    <Star className="w-5 h-5 fill-current" />
                </div>
            )}
            
            <div className="relative mb-4">
                <div className={`w-24 h-24 rounded-full border-4 ${borderColor} overflow-hidden bg-dark shadow-xl`}>
                    <img 
                        src={(type === 'player' ? item.profilePicUrl : item.logoUrl) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${type === 'player' ? item.username : item.name}`} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                    />
                </div>
                {type === 'player' && item.status === 'online' && (
                    <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-dark rounded-full"></div>
                )}
                <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full ${isFirst ? 'bg-yellow-500' : isSecond ? 'bg-gray-400' : 'bg-amber-700'} flex items-center justify-center font-black text-black text-lg shadow-lg`}>
                    {rank}
                </div>
            </div>

            <div className="text-center">
                <h3 className="text-xl font-black text-white truncate max-w-[150px] mb-1 group-hover:text-brand-400 transition">
                    {type === 'player' ? item.username : item.name}
                </h3>
                <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {type === 'player' ? item.teamName || 'Free Agent' : item.tag || 'TEAM'}
                    </span>
                    <RankIndicator change={item.rankChange} />
                </div>
                <div className="bg-white/10 px-4 py-1.5 rounded-full">
                    <span className="text-brand-400 font-black">NPR {item.totalEarnings?.toLocaleString() || 0}</span>
                </div>
            </div>
        </motion.div>
    );
};

const Leaderboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState<'players' | 'teams'>('players');
    const [season, setSeason] = useState('Season 4');
    const [players, setPlayers] = useState<UserProfile[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchLeaderboard();
    }, [view, season]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            if (view === 'players') {
                const q = query(
                    collection(db, 'users_public'),
                    orderBy('totalEarnings', 'desc'),
                    limit(50)
                );
                const querySnapshot = await getDocs(q);
                const playersData = querySnapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                } as UserProfile));
                setPlayers(playersData);
            } else {
                const q = query(
                    collection(db, 'teams'),
                    orderBy('totalEarnings', 'desc'),
                    limit(50)
                );
                const querySnapshot = await getDocs(q);
                const teamsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Team));
                setTeams(teamsData);
            }
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPlayers = players.filter(p => 
        p.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredTeams = teams.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const currentList = view === 'players' ? filteredPlayers : filteredTeams;
    const podium = currentList.slice(0, 3);
    const rest = currentList.slice(3);

    return (
        <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-500/20 rounded-lg">
                            <Trophy className="w-6 h-6 text-brand-500" />
                        </div>
                        <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Leaderboard</h1>
                    </div>
                    <p className="text-gray-400 font-medium">The elite of NexPlay. Updated in real-time.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Season Filter */}
                    <div className="relative">
                        <select 
                            value={season}
                            onChange={(e) => setSeason(e.target.value)}
                            className="appearance-none bg-dark border border-gray-800 text-white px-6 py-3 pr-12 rounded-2xl font-bold focus:border-brand-500 outline-none transition cursor-pointer"
                        >
                            <option>Season 4</option>
                            <option>Season 3</option>
                            <option>All Time</option>
                        </select>
                        <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-dark p-1 rounded-2xl border border-gray-800">
                        <button 
                            onClick={() => setView('players')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition ${view === 'players' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Users className="w-4 h-4" /> Players
                        </button>
                        <button 
                            onClick={() => setView('teams')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition ${view === 'teams' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Trophy className="w-4 h-4" /> Teams
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-12">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                    type="text"
                    placeholder={`Search ${view}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-dark border border-gray-800 rounded-3xl py-5 pl-16 pr-6 text-white font-bold focus:border-brand-500 outline-none transition shadow-2xl"
                />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Fetching Rankings...</p>
                </div>
            ) : (
                <>
                    {/* Podium Section */}
                    {currentList.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 items-end">
                            {/* 2nd Place */}
                            {podium[1] && <PodiumCard item={podium[1]} rank={2} type={view === 'players' ? 'player' : 'team'} navigate={navigate} />}
                            {/* 1st Place */}
                            {podium[0] && <PodiumCard item={podium[0]} rank={1} type={view === 'players' ? 'player' : 'team'} navigate={navigate} />}
                            {/* 3rd Place */}
                            {podium[2] && <PodiumCard item={podium[2]} rank={3} type={view === 'players' ? 'player' : 'team'} navigate={navigate} />}
                        </div>
                    )}

                    {/* Separator */}
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent mb-12"></div>

                    {/* List Section */}
                    <div className="space-y-3">
                        {rest.map((item, index) => {
                            const rank = index + 4;
                            const isUser = view === 'players' && item.uid === user?.uid;
                            
                            return (
                                <motion.div 
                                    key={view === 'players' ? item.uid : item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => navigate(view === 'players' ? `/user/${item.uid}` : `/team/${item.id}`)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition cursor-pointer group ${isUser ? 'bg-brand-500/10 border-brand-500/50' : 'bg-dark border-gray-800 hover:border-gray-700'}`}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-8 text-center">
                                            <span className={`font-black ${isUser ? 'text-brand-400' : 'text-gray-500'}`}>{rank}</span>
                                        </div>
                                        
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
                                                <img 
                                                    src={(view === 'players' ? item.profilePicUrl : item.logoUrl) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${view === 'players' ? item.username : item.name}`} 
                                                    alt="Avatar" 
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            {view === 'players' && item.status === 'online' && (
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-dark rounded-full"></div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className={`font-black text-lg ${isUser ? 'text-brand-400' : 'text-white'} group-hover:text-brand-400 transition`}>
                                                    {view === 'players' ? item.username : item.name}
                                                </h4>
                                                {isUser && (
                                                    <span className="bg-brand-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">YOU</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                    {view === 'players' ? item.teamName || 'Free Agent' : item.tag || 'TEAM'}
                                                </span>
                                                <RankIndicator change={item.rankChange} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Earnings</p>
                                            <p className="font-black text-white">NPR {item.totalEarnings?.toLocaleString() || 0}</p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-brand-500 transition" />
                                    </div>
                                </motion.div>
                            );
                        })}

                        {rest.length === 0 && !loading && (
                            <div className="text-center py-20 bg-dark rounded-3xl border border-dashed border-gray-800">
                                <Search className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No results found for your search</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default Leaderboard;
