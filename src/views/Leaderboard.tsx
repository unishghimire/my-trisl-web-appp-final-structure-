import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { formatCurrency } from '../utils';
import { Crown } from 'lucide-react';

const Leaderboard: React.FC = () => {
    const [topEarners, setTopEarners] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const snap = await getDocs(query(
                    collection(db, 'users_public'),
                    orderBy('totalEarnings', 'desc'),
                    limit(10)
                ));
                const earners = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
                setTopEarners(earners);
            } catch (error) {
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
                <div className="loader mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono">ESTABLISHING UPLINK...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white neon-text flex items-center justify-center gap-2">
                    <Crown className="w-8 h-8 text-yellow-500" /> Top Earners
                </h2>
            </div>
            <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
                <div className="bg-gray-800 p-4 border-b border-gray-700 flex text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <div className="w-12 text-center">Rank</div>
                    <div className="flex-grow pl-4">Player</div>
                    <div>Earnings</div>
                </div>
                <div className="divide-y divide-gray-800">
                    {topEarners.length > 0 ? (
                        topEarners.map((u, index) => {
                            const rank = index + 1;
                            const isTop3 = rank <= 3;
                            return (
                                <div key={u.uid} className={`flex items-center p-4 ${rank === 1 ? 'bg-gradient-to-r from-yellow-900/20 to-transparent border-l-4 border-yellow-500' : 'bg-card'} border-b border-gray-800`}>
                                    <div className="w-12 text-center text-xl">
                                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                                    </div>
                                    <div className="flex-grow pl-4">
                                        <div className="font-bold text-white">{u.username}</div>
                                        <div className="text-xs text-gray-500">ID: {u.inGameId || '---'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-brand-400 font-bold">{formatCurrency(u.totalEarnings)}</div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-8 text-center text-gray-500">No data available yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
