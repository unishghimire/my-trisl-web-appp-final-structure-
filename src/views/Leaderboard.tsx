import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { formatCurrency } from '../utils';
import { Crown, Users, TrendingUp, Award } from 'lucide-react';

const Leaderboard: React.FC = () => {
    const [topEarners, setTopEarners] = useState<UserProfile[]>([]);
    const [topTeams, setTopTeams] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'players' | 'teams'>('players');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                // Fetch players
                const playersSnap = await getDocs(query(
                    collection(db, 'users_public'),
                    where('totalEarnings', '>', 0),
                    orderBy('totalEarnings', 'desc'),
                    limit(20)
                ));
                const earners = playersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
                setTopEarners(earners);

                // Fetch teams
                const teamsSnap = await getDocs(query(
                    collection(db, 'teams'),
                    where('totalEarnings', '>', 0),
                    orderBy('totalEarnings', 'desc'),
                    limit(20)
                ));
                const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTopTeams(teams);
            } catch (error: any) {
                console.error("Error fetching leaderboard:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-brand-500 text-sm font-mono tracking-widest">LOADING RANKINGS...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-4xl mx-auto p-4 md:p-6">
            <div className="text-center mb-10">
                <h2 className="text-4xl font-black text-white mb-2 tracking-tight flex items-center justify-center gap-3">
                    <Award className="w-10 h-10 text-brand-500" /> Global Rankings
                </h2>
                <p className="text-gray-400 font-medium">Top performers across the platform</p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center gap-2 mb-8 bg-dark p-1 rounded-xl border border-gray-800 w-fit mx-auto">
                <button 
                    onClick={() => setActiveTab('players')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 ${activeTab === 'players' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <Crown className="w-4 h-4" /> Players
                </button>
                <button 
                    onClick={() => setActiveTab('teams')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 ${activeTab === 'teams' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <Users className="w-4 h-4" /> Teams
                </button>
            </div>

            {activeTab === 'players' ? (
                <div className="bg-surface rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
                    <div className="grid grid-cols-[60px,1fr,auto] items-center p-5 border-b border-gray-800 bg-dark/50 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                        <div className="text-center">Rank</div>
                        <div className="pl-2">Player</div>
                        <div className="text-right">Earnings</div>
                    </div>
                    <div className="divide-y divide-gray-800">
                        {topEarners.length > 0 ? (
                            topEarners.map((u, index) => {
                                const rank = index + 1;
                                return (
                                    <div key={u.uid} className="grid grid-cols-[60px,1fr,auto] items-center p-4 hover:bg-white/5 transition">
                                        <div className="text-center font-black text-lg">
                                            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : <span className="text-gray-600">#{rank}</span>}
                                        </div>
                                        <div className="flex items-center gap-3 pl-2">
                                            <img src={u.profilePicture || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + u.username} alt={u.username} className="w-10 h-10 rounded-full bg-dark border border-gray-700" />
                                            <div>
                                                <div className="font-bold text-white text-sm">{u.username}</div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ID: {u.inGameId || '---'}</div>
                                            </div>
                                        </div>
                                        <div className="text-right font-black text-brand-400 text-sm">
                                            {formatCurrency(u.totalEarnings)}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-12 text-center text-gray-500 font-bold">No ranked players yet.</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-surface rounded-2xl overflow-hidden border border-gray-800 shadow-xl">
                    <div className="grid grid-cols-[60px,1fr,auto] items-center p-5 border-b border-gray-800 bg-dark/50 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                        <div className="text-center">Rank</div>
                        <div className="pl-2">Team</div>
                        <div className="text-right">Earnings</div>
                    </div>
                    <div className="divide-y divide-gray-800">
                        {topTeams.length > 0 ? (
                            topTeams.map((t, index) => {
                                const rank = index + 1;
                                return (
                                    <div key={t.id} className="grid grid-cols-[60px,1fr,auto] items-center p-4 hover:bg-white/5 transition">
                                        <div className="text-center font-black text-lg">
                                            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : <span className="text-gray-600">#{rank}</span>}
                                        </div>
                                        <div className="flex items-center gap-3 pl-2">
                                            <img src={t.logoUrl || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + t.name} alt={t.name} className="w-10 h-10 rounded-lg bg-dark border border-gray-700" />
                                            <div className="font-bold text-white text-sm">{t.name}</div>
                                        </div>
                                        <div className="text-right font-black text-brand-400 text-sm">
                                            {formatCurrency(t.totalEarnings)}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-12 text-center text-gray-500 font-bold">No ranked teams yet.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
