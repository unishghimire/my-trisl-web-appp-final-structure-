import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Tournament, SiteSettings } from '../types';
import { formatCurrency, timeAgo } from '../utils';
import { useNavigate } from 'react-router-dom';
import { Trophy, Eye, Upload, BarChart, User, Shield, AlertTriangle, Users } from 'lucide-react';
import ResultUploadModal from '../components/ResultUploadModal';
import { Team } from '../types';

const Dashboard: React.FC = () => {
    const { user, profile } = useAuth();
    const [myTournaments, setMyTournaments] = useState<(Tournament & { role: 'participant' | 'organizer'; registration?: any })[]>([]);
    const [myTeams, setMyTeams] = useState<Team[]>([]);
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
            
            const joinedTours: (Tournament & { role: 'participant' | 'organizer'; registration?: any })[] = [];
            for (const pDoc of partSnap.docs) {
                const pData = pDoc.data();
                const tDoc = await getDoc(doc(db, 'tournaments', pData.tournamentId));
                if (tDoc.exists()) {
                    joinedTours.push({ 
                        id: tDoc.id, 
                        ...tDoc.data(), 
                        role: 'participant',
                        registration: pData 
                    } as Tournament & { role: 'participant' | 'organizer'; registration?: any });
                }
            }

            // Fetch Hosted Tournaments if organizer/admin
            let hostedTours: (Tournament & { role: 'participant' | 'organizer'; registration?: any })[] = [];
            if (profile?.role === 'organizer' || profile?.role === 'admin') {
                const hostedSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('hostUid', '==', user.uid),
                    orderBy('createdAt', 'desc')
                ));
                hostedTours = hostedSnap.docs.map(d => ({ id: d.id, ...d.data(), role: 'organizer' } as Tournament & { role: 'participant' | 'organizer'; registration?: any }));
            }

            // Merge and remove duplicates (if any)
            const allTours = [...hostedTours, ...joinedTours];
            const uniqueTours = allTours.filter((t, index, self) => 
                index === self.findIndex((m) => m.id === t.id)
            );
            
            setMyTournaments(uniqueTours);

            // Fetch My Teams
            const memberQ = query(collection(db, 'team_members'), where('userId', '==', user.uid));
            const memberSnap = await getDocs(memberQ);
            const myTeamIds = memberSnap.docs.map(d => d.data().teamId);
            
            if (myTeamIds.length > 0) {
                const teamsData: Team[] = [];
                for (const teamId of myTeamIds) {
                    const teamDoc = await getDoc(doc(db, 'teams', teamId));
                    if (teamDoc.exists()) {
                        teamsData.push({ id: teamDoc.id, ...teamDoc.data() } as Team);
                    }
                }
                setMyTeams(teamsData);
            }

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
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Dashboard...</p>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div onClick={() => navigate('/profile')} className="bg-card p-6 rounded-2xl border border-gray-800 hover:border-brand-500/50 transition cursor-pointer group shadow-lg flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-dark flex items-center justify-center border border-gray-700 group-hover:border-brand-500 transition">
                        <User className="w-6 h-6 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="text-white font-black uppercase tracking-widest text-sm group-hover:text-brand-400 transition">My Profile</h3>
                        <p className="text-gray-500 text-xs font-bold">Manage your account</p>
                    </div>
                </div>
                <div onClick={() => navigate('/teams')} className="bg-card p-6 rounded-2xl border border-gray-800 hover:border-brand-500/50 transition cursor-pointer group shadow-lg flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-dark flex items-center justify-center border border-gray-700 group-hover:border-brand-500 transition">
                        <Users className="w-6 h-6 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="text-white font-black uppercase tracking-widest text-sm group-hover:text-brand-400 transition">My Teams</h3>
                        <p className="text-gray-500 text-xs font-bold">{myTeams.length} Active Teams</p>
                    </div>
                </div>
            </div>

            <h3 className="text-xl font-bold mb-4 text-white uppercase tracking-widest">My Tournaments</h3>
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
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                {t.role === 'organizer' ? (
                                                    <span className="bg-brand-900/50 text-brand-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-brand-500/30 flex items-center gap-1">
                                                        <Shield className="w-2.5 h-2.5" /> HOST
                                                    </span>
                                                ) : (
                                                    <span className="bg-blue-900/50 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                                                        <User className="w-2.5 h-2.5" /> PLAYER
                                                    </span>
                                                )}
                                                <span className="bg-gray-800 text-gray-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-700">{t.game}</span>
                                                <span className="bg-brand-600/20 text-brand-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-brand-500/20 uppercase">{t.teamType}</span>
                                                <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-500/20 uppercase">{t.type}</span>
                                            </div>
                                            <h3 
                                                className="font-bold text-lg text-white group-hover:text-brand-400 transition cursor-pointer" 
                                                onClick={() => navigate(`/details/${t.id}`)}
                                            >
                                                {t.title}
                                            </h3>
                                            {t.registration && (
                                                <div className="flex flex-col gap-1 mt-1">
                                                    <div className="flex gap-4">
                                                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                                            Team: <span className="text-brand-400">{t.registration.teamName || 'SOLO'}</span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                                            UID: <span className="text-brand-400">{t.registration.inGameId}</span>
                                                        </div>
                                                        {t.registration.inGameName && (
                                                            <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                                                IGN: <span className="text-brand-400">{t.registration.inGameName}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {t.registration.teammates && t.registration.teammates.length > 0 && (
                                                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                                            Teammates: <span className="text-brand-400">{t.registration.teammates.join(', ')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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
                                            <button 
                                                onClick={() => navigate(`/details/${t.id}?tab=results`)}
                                                className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                                            >
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
