import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, getDoc, writeBatch, increment, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Tournament, Participant } from '../types';
import { Plus, Settings, Play, Save, Upload, Trophy, Users, DollarSign, Calendar, LayoutDashboard, Search, Filter, Trash2, Eye, Map as MapIcon, Gamepad, ChevronRight, Edit, CreditCard, Clock } from 'lucide-react';
import Modal from '../components/Modal';
import { NotificationService } from '../services/NotificationService';
import { useNotification } from '../context/NotificationContext';
import ResultUploadModal from '../components/ResultUploadModal';
import TournamentCreateModal from '../components/TournamentCreateModal';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

const OrganizerPanel: React.FC = () => {
    // Force Vite cache invalidation
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const [hostedTournaments, setHostedTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [roomId, setRoomId] = useState('');
    const [roomPass, setRoomPass] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchHosted = React.useCallback(async () => {
        if (!user) return;
        try {
            const q = query(
                collection(db, 'tournaments'),
                where('hostUid', '==', user.uid),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            setHostedTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));
        } catch (error) {
            console.error("Error fetching hosted tournaments:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchHosted();
    }, [fetchHosted]);

    const [selectedTeam, setSelectedTeam] = useState<{ name: string; members: any[]; teamId?: string; logoUrl?: string } | null>(null);
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [fetchingTeam, setFetchingTeam] = useState(false);

    const handleManage = async (t: Tournament) => {
        setSelectedTournament(t);
        setRoomId(t.roomId || '');
        setRoomPass(t.roomPass || '');
        setIsManageModalOpen(true);
        
        // Fetch participants for this tournament
        try {
            const q = query(collection(db, 'participants'), where('tournamentId', '==', t.id));
            const snap = await getDocs(q);
            setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error fetching participants:", error);
        }
    };

    // Group participants by team
    const teams = participants.reduce((acc: any, p) => {
        const teamKey = p.teamId || p.teamName || 'Solo Players';
        if (!acc[teamKey]) acc[teamKey] = { name: p.teamName || 'Solo Players', members: [], teamId: p.teamId };
        acc[teamKey].members.push(p);
        return acc;
    }, {});

    const handleTeamClick = async (teamKey: string, teamData: any) => {
        if (teamData.teamId) {
            setFetchingTeam(true);
            setSelectedTeam({ ...teamData });
            setIsTeamModalOpen(true);
            try {
                const teamDoc = await getDoc(doc(db, 'teams', teamData.teamId));
                if (teamDoc.exists()) {
                    setSelectedTeam({ ...teamData, logoUrl: teamDoc.data().logoUrl });
                }
            } catch (error) {
                console.error("Error fetching team details:", error);
            } finally {
                setFetchingTeam(false);
            }
        } else {
            setSelectedTeam({ ...teamData });
            setIsTeamModalOpen(true);
        }
    };

    const handleDelete = async () => {
        if (!selectedTournament) return;
        try {
            await deleteDoc(doc(db, 'tournaments', selectedTournament.id));
            showToast('Tournament deleted successfully', 'success');
            setIsDeleteModalOpen(false);
            setSelectedTournament(null);
            fetchHosted();
        } catch (error) {
            console.error("Error deleting tournament:", error);
            showToast('Failed to delete tournament', 'error');
        }
    };

    const handleUpdateStatus = async (status: 'upcoming' | 'live' | 'completed' | 'current') => {
        if (!selectedTournament) return;
        try {
            const batch = writeBatch(db);
            const tRef = doc(db, 'tournaments', selectedTournament.id);
            const newStatus = status === 'current' ? selectedTournament.status : status;
            
            batch.update(tRef, {
                roomId,
                roomPass,
                status: newStatus
            });

            if (status === 'completed' && selectedTournament.status !== 'completed') {
                // Calculate earnings
                const participantsSnap = await getDocs(query(collection(db, 'participants'), where('tournamentId', '==', selectedTournament.id)));
                const exactPlayers = participantsSnap.docs.length;
                
                const entryFeeTotal = selectedTournament.entryFee * exactPlayers;
                const prizePoolTotal = selectedTournament.prizePool;
                const profit = entryFeeTotal - prizePoolTotal;
                
                let orgShare = 0;
                let nexplayShare = 0;
                let earningStatus: 'pending' | 'no_earnings' = 'no_earnings';
                
                if (profit > 0) {
                    orgShare = profit * 0.85;
                    nexplayShare = profit * 0.15;
                    earningStatus = 'pending';
                    
                    // Add to org pending earnings
                    const orgRef = doc(db, 'users', selectedTournament.hostUid);
                    batch.update(orgRef, {
                        orgPendingEarnings: increment(orgShare)
                    });
                }
                
                const earningRef = doc(collection(db, 'tournamentEarnings'));
                batch.set(earningRef, {
                    tournamentId: selectedTournament.id,
                    tournamentName: selectedTournament.title,
                    orgId: selectedTournament.hostUid,
                    orgName: selectedTournament.hostName || 'Unknown Org',
                    entryFeeTotal,
                    prizePoolTotal,
                    profit,
                    orgShare,
                    nexplayShare,
                    status: earningStatus,
                    createdAt: serverTimestamp()
                });
            }
            
            await batch.commit();
            
            if (status === 'live') {
                await NotificationService.notifyParticipants(
                    selectedTournament.id,
                    'Tournament is LIVE!',
                    `${selectedTournament.title} has started! Join the room now.`,
                    'alert',
                    `/details/${selectedTournament.id}`
                );
            } else if (status === 'current' && roomId && roomId !== selectedTournament.roomId) {
                await NotificationService.notifyParticipants(
                    selectedTournament.id,
                    'Room Details Updated',
                    `Room ID and Password for ${selectedTournament.title} are now available.`,
                    'info',
                    `/details/${selectedTournament.id}`
                );
            }

            showToast(`Tournament ${status === 'current' ? 'info updated' : 'is now ' + status.toUpperCase()}`, 'success');
            setIsManageModalOpen(false);
            fetchHosted();
        } catch (error) {
            console.error("Error updating tournament:", error);
            showToast('Failed to update tournament', 'error');
        }
    };

    const filteredTournaments = hostedTournaments.filter(t => 
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.game.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: hostedTournaments.length,
        live: hostedTournaments.filter(t => t.status === 'live').length,
        completed: hostedTournaments.filter(t => t.status === 'completed').length,
        totalPrize: hostedTournaments.reduce((acc, t) => acc + (t.prizePool || 0), 0),
        orgWallet: profile?.orgWalletBalance || 0,
        pendingEarnings: profile?.orgPendingEarnings || 0
    };

    if (profile?.role !== 'organizer' && profile?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <Settings className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-gray-400 max-w-md">You do not have the necessary permissions to access the Organizer Panel.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="loader mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono uppercase tracking-widest">Initializing Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-6xl mx-auto pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                        <LayoutDashboard className="w-10 h-10 text-brand-500" />
                        Organizer <span className="text-brand-500">Panel</span>
                    </h1>
                    <p className="text-gray-400 mt-1 font-medium">Manage your tournaments and track performance.</p>
                </div>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-brand-600 hover:bg-brand-500 px-8 py-3 rounded-xl font-black text-white shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.3)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95 group"
                >
                    <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" /> CREATE NEW TOURNAMENT
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">
                {[
                    { label: 'Total Hosted', value: stats.total, icon: Trophy, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                    { label: 'Live Now', value: stats.live, icon: Play, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                    { label: 'Completed', value: stats.completed, icon: Users, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
                    { label: 'Total Prize Pool', value: `₹${stats.totalPrize.toLocaleString()}`, icon: DollarSign, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
                    { label: 'Org Wallet', value: `₹${stats.orgWallet.toLocaleString()}`, icon: CreditCard, color: 'text-brand-500', bg: 'bg-brand-500/10', border: 'border-brand-500/20' },
                    { label: 'Pending Earnings', value: `₹${stats.pendingEarnings.toLocaleString()}`, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
                ].map((stat, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`bg-surface/40 backdrop-blur-md p-6 rounded-3xl border ${stat.border} hover:border-brand-500/50 transition-all duration-300 group relative overflow-hidden`}
                    >
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl group-hover:bg-brand-500/10 transition-colors"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3.5 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                        </div>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                        <h3 className="text-3xl font-black text-white tracking-tight">{stat.value}</h3>
                    </motion.div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="bg-card rounded-3xl border border-gray-800 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-brand-500" />
                        Your Tournaments
                    </h2>
                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input 
                                type="text" 
                                placeholder="Search tournaments..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-dark border border-gray-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:border-brand-500 outline-none transition"
                            />
                        </div>
                        <button className="p-2 bg-dark border border-gray-800 rounded-xl text-gray-400 hover:text-white transition">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 min-h-[400px]">
                    <AnimatePresence mode="popLayout">
                        {filteredTournaments.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {filteredTournaments.map((t, i) => (
                                    <motion.div 
                                        key={t.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="bg-surface/30 hover:bg-surface/60 p-6 rounded-3xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border border-gray-800/50 hover:border-brand-500/30 transition-all duration-300 group relative overflow-hidden"
                                    >
                                        <div className="flex items-center gap-5 w-full lg:w-auto">
                                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-dark shrink-0 border border-gray-800 relative">
                                                <img 
                                                    src={t.bannerUrl || 'https://picsum.photos/seed/esports/200/200' || undefined} 
                                                    alt={t.title}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <h3 className="font-black text-white text-xl truncate uppercase tracking-tight group-hover:text-brand-400 transition-colors">{t.title}</h3>
                                                    <span className={`w-2 h-2 rounded-full ${
                                                        t.status === 'live' ? 'bg-red-500 animate-ping' : 
                                                        t.status === 'completed' ? 'bg-green-500' : 
                                                        'bg-blue-500'
                                                    }`}></span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] uppercase font-black border tracking-widest ${
                                                        t.status === 'live' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                                        t.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                    }`}>
                                                        {t.status}
                                                    </span> 
                                                    <div className="flex gap-1.5">
                                                        <span className="bg-dark/80 text-gray-400 px-2.5 py-1 rounded-lg text-[9px] uppercase font-black border border-gray-800 flex items-center gap-1.5 tracking-widest">
                                                            <Gamepad className="w-3 h-3" /> {t.game}
                                                        </span>
                                                        <span className="bg-brand-500/10 text-brand-500 px-2.5 py-1 rounded-lg text-[9px] uppercase font-black border border-brand-500/20 tracking-widest">{t.teamType}</span>
                                                        <span className="bg-purple-500/10 text-purple-500 px-2.5 py-1 rounded-lg text-[9px] uppercase font-black border border-purple-500/20 tracking-widest">{t.type}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between w-full lg:w-auto lg:gap-10 border-t lg:border-t-0 border-gray-800/50 pt-5 lg:pt-0">
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] mb-1">Participants</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-full bg-dark rounded-full h-1.5 w-20 overflow-hidden border border-gray-800">
                                                            <div 
                                                                className="bg-brand-500 h-full rounded-full"
                                                                style={{ width: `${(t.currentPlayers / t.slots) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-xs font-black text-white">{t.currentPlayers}/{t.slots}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] mb-1">Prize Pool</span>
                                                    <span className="text-sm font-black text-brand-400">₹{t.prizePool?.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedTournament(t);
                                                        setIsCreateModalOpen(true);
                                                    }}
                                                    className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white p-3 rounded-2xl transition-all border border-blue-500/20 active:scale-95"
                                                    title="Edit Tournament"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <Link 
                                                    to={`/tournament-admin/${t.id}`}
                                                    className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.4)] active:scale-95 uppercase tracking-widest"
                                                >
                                                    <Settings className="w-4 h-4" /> Manage
                                                </Link>
                                                <button 
                                                    onClick={() => {
                                                        setSelectedTournament(t);
                                                        setIsDeleteModalOpen(true);
                                                    }}
                                                    className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-3 rounded-2xl transition-all border border-red-500/20 active:scale-95"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
                                    <Trophy className="w-10 h-10 text-gray-600" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No Tournaments Found</h3>
                                <p className="text-gray-500 max-w-xs">
                                    {searchTerm ? `No results for "${searchTerm}"` : "You haven't created any tournaments yet. Start by creating your first one!"}
                                </p>
                                {!searchTerm && (
                                    <button 
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="mt-6 text-brand-500 font-bold hover:underline flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> Create your first tournament
                                    </button>
                                )}
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Manage Modal */}
            <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title={`Manage: ${selectedTournament?.title}`} maxWidth="max-w-3xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: Room Info */}
                    <div className="space-y-6">
                        <div className="bg-surface p-5 rounded-2xl border border-gray-800">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-brand-500" />
                                </div>
                                <h4 className="font-black text-white text-sm uppercase tracking-wider">Room Credentials</h4>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Room ID</label>
                                    <input 
                                        type="text" 
                                        value={roomId} 
                                        onChange={(e) => setRoomId(e.target.value)}
                                        placeholder="Enter Room ID" 
                                        className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Room Password</label>
                                    <input 
                                        type="text" 
                                        value={roomPass} 
                                        onChange={(e) => setRoomPass(e.target.value)}
                                        placeholder="Enter Password" 
                                        className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition font-mono"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-6">
                                <button onClick={() => handleUpdateStatus('current')} className="bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition active:scale-95">
                                    <Save className="w-4 h-4" /> SAVE INFO
                                </button>
                                <button 
                                    onClick={() => handleUpdateStatus('live')} 
                                    disabled={selectedTournament?.status === 'live'}
                                    className={`py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition active:scale-95 shadow-lg ${
                                        selectedTournament?.status === 'live' 
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                        : 'bg-red-600 hover:bg-red-500 text-white animate-pulse shadow-red-600/20'
                                    }`}
                                >
                                    <Play className="w-4 h-4" /> {selectedTournament?.status === 'live' ? 'ALREADY LIVE' : 'GO LIVE'}
                                </button>
                            </div>
                        </div>
                        
                        <div className="pt-2">
                            <button 
                                onClick={() => {
                                    setIsManageModalOpen(false);
                                    setIsResultModalOpen(true);
                                }} 
                                className="w-full bg-green-600 hover:bg-green-500 py-4 rounded-2xl text-white font-black shadow-lg transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                <Upload className="w-6 h-6" /> FINALIZE & UPLOAD RESULTS
                            </button>
                            <p className="text-center text-[10px] text-gray-500 font-bold uppercase mt-3 tracking-widest">Only upload results after the match is finished</p>
                        </div>
                    </div>

                    {/* Right Column: Participant List */}
                    <div className="bg-surface p-5 rounded-2xl border border-gray-800 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-purple-500" />
                                </div>
                                <h4 className="font-black text-white text-sm uppercase tracking-wider">Teams ({Object.keys(teams).length})</h4>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar space-y-2">
                            {Object.keys(teams).length > 0 ? (
                                Object.entries(teams).map(([teamKey, teamData]: [string, any], idx) => {
                                    const totalMembers = teamData.members.reduce((sum: number, m: any) => sum + 1 + (m.teammates?.length || 0), 0);
                                    return (
                                    <div 
                                        key={idx} 
                                        onClick={() => handleTeamClick(teamKey, teamData)}
                                        className="bg-dark/50 p-3 rounded-xl border border-gray-800/50 flex justify-between items-center cursor-pointer hover:border-brand-500/50 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-brand-600/10 rounded-lg flex items-center justify-center text-brand-500 font-black text-xs">
                                                {totalMembers}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white group-hover:text-brand-400 transition-colors uppercase tracking-tight">{teamData.name}</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{totalMembers} Members</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-500 transition-all" />
                                    </div>
                                )})
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <Users className="w-8 h-8 text-gray-700 mb-2" />
                                    <p className="text-xs text-gray-500">No participants yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Team Details Modal */}
            <Modal isOpen={isTeamModalOpen} onClose={() => setIsTeamModalOpen(false)} title={`Team: ${selectedTeam?.name}`} maxWidth="max-w-md">
                <div className="space-y-4">
                    <div className="bg-brand-600/10 p-4 rounded-2xl border border-brand-500/20 mb-6 flex items-center gap-4">
                        <div className="w-16 h-16 bg-dark rounded-xl border border-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                            {fetchingTeam ? (
                                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : selectedTeam?.logoUrl ? (
                                <img src={selectedTeam.logoUrl || undefined} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <Users className="w-8 h-8 text-gray-700" />
                            )}
                        </div>
                        <div>
                            <div className="text-[10px] text-brand-500 font-black uppercase tracking-widest mb-1">Team Name</div>
                            <div className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-1">{selectedTeam?.name}</div>
                            {selectedTeam?.teamId && (
                                <Link 
                                    to={`/team/${selectedTeam.teamId}`}
                                    className="text-[10px] text-brand-400 font-black uppercase tracking-widest hover:text-brand-300 transition flex items-center gap-1"
                                >
                                    View Team Profile <ChevronRight className="w-3 h-3" />
                                </Link>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Team Members</div>
                        {selectedTeam?.members.map((member: any, i: number) => (
                            <div key={i} className="bg-surface p-4 rounded-xl border border-gray-800 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 font-black text-xs">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div className="text-white font-black text-sm uppercase tracking-tight">{member.username}</div>
                                            <div className="text-[10px] text-gray-500 font-mono">UID: {member.inGameId}</div>
                                            {member.inGameName && <div className="text-[10px] text-gray-500 font-mono">IGN: {member.inGameName}</div>}
                                        </div>
                                    </div>
                                    <div className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest">
                                        Verified
                                    </div>
                                </div>
                                {member.teammates && member.teammates.length > 0 && (
                                    <div className="pl-11 space-y-2 mt-2 border-t border-gray-800/50 pt-3">
                                        <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Registered Teammates</div>
                                        {member.teammates.map((tm: string, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-500/50"></div>
                                                <span className="text-xs text-gray-300 font-mono">{tm}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={() => setIsTeamModalOpen(false)}
                        className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-black uppercase tracking-widest mt-6 transition"
                    >
                        Close
                    </button>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Tournament">
                <div className="p-4 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Are you sure?</h3>
                    <p className="text-gray-400 mb-6">
                        This action cannot be undone. All data related to <strong>{selectedTournament?.title}</strong> will be permanently deleted.
                    </p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleDelete}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold transition shadow-lg shadow-red-600/20"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Create/Edit Modal */}
            <TournamentCreateModal 
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setSelectedTournament(null);
                }}
                onSuccess={fetchHosted}
                editTournament={selectedTournament}
            />

            {/* Result Modal */}
            {selectedTournament && (
                <ResultUploadModal 
                    isOpen={isResultModalOpen}
                    onClose={() => setIsResultModalOpen(false)}
                    tournament={selectedTournament}
                    onSuccess={fetchHosted}
                />
            )}
        </div>
    );
};

export default OrganizerPanel;
