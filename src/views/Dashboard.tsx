import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Tournament, SiteSettings } from '../types';
import { formatCurrency, timeAgo } from '../utils';
import { useNavigate } from 'react-router-dom';
import { Trophy, Eye, Upload, BarChart, User, Shield, AlertTriangle } from 'lucide-react';
import ResultUploadModal from '../components/ResultUploadModal';

const Dashboard: React.FC = () => {
    const { user, profile } = useAuth();
    const [myTournaments, setMyTournaments] = useState<(Tournament & { role: 'participant' | 'organizer' })[]>([]);
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const navigate = useNavigate();

    const fetchAllData = async () => {
        if (!user) return;
        try {
            // Fetch Joined Tournaments
            const partSnap = await getDocs(query(
                collection(db, 'participants'),
                where('userId', '==', user.uid),
                orderBy('timestamp', 'desc')
            ));
            
            const tourIds = partSnap.docs.map(d => d.data().tournamentId);
            const tourPromises = tourIds.map(id => getDoc(doc(db, 'tournaments', id)));
            const tourSnaps = await Promise.all(tourPromises);
            
            const joinedTours = tourSnaps
                .filter(s => s.exists())
                .map(s => ({ id: s.id, ...s.data(), role: 'participant' } as Tournament & { role: 'participant' | 'organizer' }));

            // Fetch Hosted Tournaments if organizer/admin
            let hostedTours: (Tournament & { role: 'participant' | 'organizer' })[] = [];
            if (profile?.role === 'organizer' || profile?.role === 'admin') {
                const hostedSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('hostUid', '==', user.uid),
                    orderBy('createdAt', 'desc')
                ));
                hostedTours = hostedSnap.docs.map(d => ({ id: d.id, ...d.data(), role: 'organizer' } as Tournament & { role: 'participant' | 'organizer' }));
            }

            // Merge and remove duplicates (if any)
            const allTours = [...hostedTours, ...joinedTours];
            const uniqueTours = allTours.filter((t, index, self) => 
                index === self.findIndex((m) => m.id === t.id)
            );
            
            setMyTournaments(uniqueTours);

            // Fetch Site Settings
            const settingsSnap = await getDoc(doc(db, 'settings', 'site'));
            if (settingsSnap.exists()) {
                setSettings(settingsSnap.data() as SiteSettings);
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [user, profile]);

    const handleUploadResult = (t: Tournament) => {
        setSelectedTournament(t);
        setIsResultModalOpen(true);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="loader mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono">ESTABLISHING UPLINK...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-3xl mx-auto">
            {/* Site Notice */}
            {settings?.showNotice && settings.siteNotice && (
                <div className="mb-6 bg-brand-900/20 border border-brand-500/30 p-4 rounded-xl flex gap-3 items-start animate-pulse">
                    <AlertTriangle className="text-brand-400 shrink-0 w-5 h-5 mt-0.5" />
                    <div className="text-xs text-brand-200 leading-relaxed font-bold uppercase">
                        <span className="block text-brand-400 mb-1">IMPORTANT NOTICE</span>
                        {settings.siteNotice}
                    </div>
                </div>
            )}

            <h2 className="text-2xl font-bold mb-6 text-white border-b border-gray-800 pb-4">My Dashboard</h2>
            <div className="space-y-4">
                {myTournaments.length > 0 ? (
                    myTournaments.map(t => {
                        const isLive = t.status === 'live';
                        const isCompleted = t.status === 'completed';
                        const showRoom = isLive || (t.status === 'upcoming' && t.roomId);

                        return (
                            <div key={t.id} className="bg-surface p-5 rounded-xl mb-4 border border-gray-700 shadow-lg relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition">
                                    <Trophy className="w-16 h-16" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                {t.role === 'organizer' ? (
                                                    <span className="bg-brand-900/50 text-brand-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-brand-500/30 flex items-center gap-1">
                                                        <Shield className="w-2.5 h-2.5" /> HOST
                                                    </span>
                                                ) : (
                                                    <span className="bg-blue-900/50 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                                                        <User className="w-2.5 h-2.5" /> PLAYER
                                                    </span>
                                                )}
                                            </div>
                                            <h3 
                                                className="font-bold text-lg text-white group-hover:text-brand-400 transition cursor-pointer" 
                                                onClick={() => navigate(`/details/${t.id}`)}
                                            >
                                                {t.title}
                                            </h3>
                                            <div className={`text-xs uppercase tracking-wide ${isLive ? 'text-red-500 animate-pulse font-bold' : isCompleted ? 'text-green-500' : 'text-blue-400'}`}>
                                                {t.status}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-brand-400 font-bold">{formatCurrency(t.prizePool)}</div>
                                        </div>
                                    </div>
                                    {showRoom && (
                                        <div className="mt-3 bg-gray-900 p-2 rounded border border-gray-700 flex gap-4 text-sm font-mono">
                                            <div>
                                                <span className="text-gray-500">ID:</span> <span className="text-white select-all">{t.roomId || 'Wait'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Pass:</span> <span className="text-white select-all">{t.roomPass || 'Wait'}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-4 flex gap-3 text-sm border-t border-gray-700 pt-3">
                                        <button onClick={() => navigate(`/details/${t.id}`)} className="text-gray-300 hover:text-white flex items-center gap-1">
                                            <Eye className="w-4 h-4" /> Details
                                        </button>
                                        {isLive && t.role === 'organizer' && (
                                            <button 
                                                onClick={() => handleUploadResult(t)}
                                                className="text-green-400 hover:text-green-300 flex items-center gap-1"
                                            >
                                                <Upload className="w-4 h-4" /> Upload Result
                                            </button>
                                        )}
                                        {isCompleted && (
                                            <button className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1">
                                                <BarChart className="w-4 h-4" /> View Result
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-center text-gray-500">No matches found.</p>
                )}
            </div>
            {selectedTournament && (
                <ResultUploadModal 
                    isOpen={isResultModalOpen}
                    onClose={() => setIsResultModalOpen(false)}
                    tournament={selectedTournament}
                    onSuccess={fetchAllData}
                />
            )}
        </div>
    );
};

export default Dashboard;
