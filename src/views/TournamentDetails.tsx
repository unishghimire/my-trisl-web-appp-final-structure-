import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, runTransaction, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, UserProfile } from '../types';
import { DEFAULT_BANNER } from '../constants';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, getYoutubeId } from '../utils';
import { Clock, Users, Trophy, Lock, Eye, EyeOff, Play, Share2, Calendar, MapPin, Info, Medal, ExternalLink, ChevronRight, AlertCircle, CheckCircle2, Search, Filter, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../components/Modal';
import { NotificationService } from '../services/NotificationService';
import { useNotification } from '../context/NotificationContext';
import { Helmet } from 'react-helmet-async';
import ProfileLink from '../components/ProfileLink';

const TournamentDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [isJoined, setIsJoined] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'description' | 'participants' | 'results'>(
        (searchParams.get('tab') as any) || 'overview'
    );
    const [participants, setParticipants] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [relatedTournaments, setRelatedTournaments] = useState<Tournament[]>([]);
    const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [teammate1, setTeammate1] = useState('');
    const [teammate2, setTeammate2] = useState('');
    const [teammate3, setTeammate3] = useState('');
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [hostProfile, setHostProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // 1. Fetch Tournament Details
                const docRef = doc(db, 'tournaments', id);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) {
                    setLoading(false);
                    return;
                }
                
                const tData = { id: docSnap.id, ...docSnap.data() } as Tournament;
                setTournament(tData);

                // 2. Fetch related data concurrently
                const promises: Promise<any>[] = [];

                // Participants
                const partQ = query(collection(db, 'participants'), where('tournamentId', '==', id));
                promises.push(getDocs(partQ).then(snap => setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() })))));

                // Related Tournaments
                if (tData.game) {
                    const relQ = query(
                        collection(db, 'tournaments'), 
                        where('status', '==', 'upcoming'),
                        where('game', '==', tData.game)
                    );
                    promises.push(getDocs(relQ).then(snap => {
                        const other = snap.docs
                            .map(d => ({ id: d.id, ...d.data() } as Tournament))
                            .filter(t => t.id !== tData.id)
                            .slice(0, 3);
                        setRelatedTournaments(other);
                    }));
                }

                // Host Profile
                if (tData.hostUid) {
                    const hostRef = doc(db, 'users_public', tData.hostUid);
                    promises.push(getDoc(hostRef).then(snap => {
                        if (snap.exists()) {
                            setHostProfile({ uid: snap.id, ...snap.data() } as UserProfile);
                        }
                    }));
                }

                // User Join Status
                if (user) {
                    const userJoinQ = query(
                        collection(db, 'participants'),
                        where('tournamentId', '==', id),
                        where('userId', '==', user.uid)
                    );
                    promises.push(getDocs(userJoinQ).then(async (pSnap) => {
                        let joined = !pSnap.empty;
                        if (!joined && profile?.teamId) {
                            const teamSnap = await getDocs(query(
                                collection(db, 'participants'),
                                where('tournamentId', '==', id),
                                where('teamId', '==', profile.teamId)
                            ));
                            if (!teamSnap.empty) {
                                joined = true;
                            }
                        }
                        setIsJoined(joined);
                    }));
                }

                await Promise.all(promises);

            } catch (error) {
                console.error("Error fetching tournament data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [id, user, profile?.teamId]);

    useEffect(() => {
        const fetchTeamMembers = async () => {
            if (profile?.teamId) {
                try {
                    const q = query(collection(db, 'team_members'), where('teamId', '==', profile.teamId));
                    const snap = await getDocs(q);
                    const members = snap.docs.map(d => d.data());
                    
                    // Fetch user profiles for these members to get their inGameName
                    const profiles = await Promise.all(members.map(async (m) => {
                        const userDoc = await getDoc(doc(db, 'users_public', m.userId));
                        if (userDoc.exists()) {
                            return { ...m, ...userDoc.data() };
                        }
                        return m;
                    }));
                    
                    // Filter out the current user
                    setTeamMembers(profiles.filter(p => p.userId !== user?.uid));
                } catch (error) {
                    console.error("Error fetching team members:", error);
                }
            }
        };
        fetchTeamMembers();
    }, [profile?.teamId, user?.uid]);

    useEffect(() => {
        if (!tournament?.startTime) return;

        const start = new Date(tournament.startTime).getTime();
        if (isNaN(start)) {
            console.error("Invalid tournament start time:", tournament.startTime);
            return;
        }

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const diff = start - now;

            if (diff <= 0) {
                setTimeLeft(null);
                clearInterval(timer);
                return;
            }

            setTimeLeft({
                d: Math.floor(diff / (1000 * 60 * 60 * 24)),
                h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                s: Math.floor((diff % (1000 * 60)) / 1000)
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [tournament?.startTime]);

    const filteredParticipants = participants.filter(p => 
        p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.inGameId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.teamName && p.teamName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.teammates && p.teammates.some((tm: string) => tm.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const handleJoinClick = () => {
        if (!user) {
            showToast("Please login to join!", "warning");
            return;
        }
        if (!tournament || !profile) return;

        // Requirement: In-game ID is compulsory for all games
        if (!profile.inGameId) {
            showToast("In-Game ID is required for all tournaments!", "warning");
            navigate('/profile');
            return;
        }

        // Requirement: In-game Name is compulsory for all games
        if (!profile.inGameName) {
            showToast("In-Game Name is required for all tournaments!", "warning");
            navigate('/profile');
            return;
        }

        // Requirement: Team Name is compulsory for all tournaments
        if (!profile.teamName) {
            showToast("Team Name is required for all tournaments!", "warning");
            navigate('/profile');
            return;
        }

        // Requirement: Team ID is compulsory for team tournaments
        if ((tournament.teamType === 'duo' || tournament.teamType === 'squad') && !profile.teamId) {
            showToast("You must be in a team to join team tournaments!", "warning");
            navigate('/teams');
            return;
        }

        if (tournament.teamType === 'duo' || tournament.teamType === 'squad') {
            setShowJoinModal(true);
        } else {
            handleJoinSubmit();
        }
    };

    const handleJoinSubmit = async () => {
        if (!user || !tournament || !profile) return;

        if (tournament.teamType === 'duo' && !teammate1) {
            showToast("Please provide your teammate's in-game name.", "warning");
            return;
        }
        if (tournament.teamType === 'squad' && (!teammate1 || !teammate2 || !teammate3)) {
            showToast("Please provide all teammates' in-game names.", "warning");
            return;
        }

        const tRef = doc(db, 'tournaments', tournament.id);
        const userRef = doc(db, 'users', user.uid);
        const partRef = doc(collection(db, 'participants'));

        try {
            await runTransaction(db, async (transaction) => {
                const tDoc = await transaction.get(tRef);
                const uDoc = await transaction.get(userRef);
                if (!tDoc.exists()) throw new Error("Tournament does not exist!");
                const tData = tDoc.data() as Tournament;
                const uData = uDoc.data() as UserProfile;

                if (tData.currentPlayers >= tData.slots) throw new Error("Tournament is Full!");
                if (uData.balance < tData.entryFee) throw new Error("Insufficient Balance!");

                transaction.update(userRef, { balance: uData.balance - tData.entryFee });
                transaction.update(tRef, { currentPlayers: tData.currentPlayers + 1 });
                
                const participantData: any = {
                    userId: user.uid,
                    tournamentId: tournament.id,
                    inGameId: uData.inGameId,
                    inGameName: uData.inGameName || '',
                    teamName: uData.teamName || '',
                    teamId: uData.teamId || '',
                    username: uData.username,
                    timestamp: serverTimestamp()
                };

                if (tData.teamType === 'duo') {
                    participantData.teammates = [teammate1];
                } else if (tData.teamType === 'squad') {
                    participantData.teammates = [teammate1, teammate2, teammate3];
                }

                transaction.set(partRef, participantData);
            });
            setIsJoined(true);
            setShowJoinModal(false);
            await NotificationService.create(
                user.uid,
                'Tournament Joined!',
                `You have successfully joined ${tournament.title}. Good luck!`,
                'success',
                `/details/${tournament.id}`
            );
            showToast('Joined Successfully!', 'success');
            navigate('/dashboard');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: tournament.title,
                text: `Join ${tournament.title} on our platform!`,
                url: window.location.href,
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
            showToast("Link copied to clipboard!", "success");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="loader mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono">ESTABLISHING UPLINK...</p>
            </div>
        );
    }

    if (!tournament) return <p className="text-center mt-10">Tournament not found.</p>;

    const bannerUrl = tournament.bannerUrl || DEFAULT_BANNER;
    const bannerStyle = { backgroundImage: `url('${bannerUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' };
    const showRoom = isJoined && (tournament.status === 'live' || (tournament.roomId && tournament.status === 'upcoming'));
    console.log("Debug showRoom:", { showRoom, isJoined, status: tournament.status, roomId: tournament.roomId });
    const ytId = getYoutubeId(tournament.ytLink);

    return (
        <div className="animate-fade-in max-w-6xl mx-auto px-4 py-6">
            {tournament && (
                <Helmet>
                    <title>{tournament.title} | NexPlay</title>
                    <meta name="description" content={`Join ${tournament.title} on NexPlay. Prize Pool: ${formatCurrency(tournament.prizePool)}.`} />
                </Helmet>
            )}
            {/* Hero Section */}
            <div className="relative h-[300px] md:h-[450px] rounded-3xl overflow-hidden mb-8 shadow-2xl group">
                <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105" style={bannerStyle}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent"></div>
                
                <div className="absolute top-6 left-6 flex flex-wrap gap-2">
                    <span className="bg-brand-600/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-xl border border-brand-500/30">
                        {tournament.game}
                    </span>
                    <span className={`backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-xl border ${
                        tournament.status === 'live' ? 'bg-red-600/90 border-red-500/30' : 
                        tournament.status === 'completed' ? 'bg-blue-600/90 border-blue-500/30' : 
                        'bg-green-600/90 border-green-500/30'
                    }`}>
                        {tournament.status}
                    </span>
                    {tournament.ytLink && tournament.status === 'live' && (
                        <span className="bg-red-600 animate-pulse text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-xl flex items-center gap-1.5">
                            <Play className="w-3 h-3 fill-current" /> LIVE STREAM
                        </span>
                    )}
                </div>

                <button 
                    onClick={handleShare}
                    aria-label="Share Tournament"
                    className="absolute top-6 right-6 p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-full transition-all border border-white/10 active:scale-90 z-20"
                >
                    <Share2 className="w-5 h-5" />
                </button>

                <div className="absolute bottom-8 left-8 right-8">
                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-7xl font-black text-white mb-4 tracking-tighter leading-none"
                    >
                        {tournament.title}
                    </motion.h1>
                    <div className="text-gray-300 font-bold text-sm mb-4">
                        Organized by: {tournament.hostUid ? <ProfileLink to={`/organization/${tournament.hostUid}`} name={tournament.hostName || 'Official Host'} /> : <span className="text-gray-500">Organization not available</span>}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-6 text-gray-300 font-bold text-sm">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-brand-500" />
                            {formatDate(tournament.startTime)}
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-brand-500" />
                            {tournament.map || 'TBD'}
                        </div>
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-brand-500" />
                            {tournament.teamType} • {tournament.type}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Tabs Navigation */}
                    <div className="flex p-1 bg-surface rounded-2xl border border-gray-800 sticky top-4 z-10 backdrop-blur-xl">
                        {[
                            { id: 'overview', label: 'Overview', icon: Info },
                            { id: 'description', label: 'Description', icon: Info },
                            { id: 'participants', label: 'Players', icon: Users },
                            { id: 'results', label: 'Results', icon: Trophy },
                        ].map((tab) => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-wider ${
                                    activeTab === tab.id 
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' 
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="hidden md:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <motion.div 
                                key="overview"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                {ytId && (
                                    <div className="rounded-3xl overflow-hidden border border-gray-800 shadow-2xl aspect-video bg-black">
                                        <iframe 
                                            src={`https://www.youtube.com/embed/${ytId}`} 
                                            frameBorder="0" 
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                            allowFullScreen 
                                            className="w-full h-full"
                                        ></iframe>
                                    </div>
                                )}
                                {tournament.ytLink && (
                                    <div className="flex justify-center">
                                        <a 
                                            href={tournament.ytLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-brand-500 hover:text-brand-400 font-bold text-sm transition"
                                        >
                                            <Play className="w-4 h-4 fill-current" /> Visit YouTube Channel
                                        </a>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Prize Pool', value: formatCurrency(tournament.prizePool), icon: Trophy, color: 'text-yellow-500' },
                                        { label: 'Entry Fee', value: tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : 'FREE', icon: Medal, color: 'text-brand-500' },
                                        { label: 'Slots', value: `${tournament.currentPlayers}/${tournament.slots}`, icon: Users, color: 'text-blue-500' },
                                        { label: 'Game Mode', value: tournament.type, icon: Play, color: 'text-red-500' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-surface p-4 rounded-2xl border border-gray-800 hover:border-gray-700 transition-colors">
                                            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                                            <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{stat.label}</div>
                                            <div className="text-white font-black text-lg">{stat.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {showRoom && (
                                    <div className="bg-brand-600/10 border border-brand-500/30 p-6 rounded-3xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                            <Play className="w-24 h-24 text-brand-500" />
                                        </div>
                                        <h3 className="text-brand-500 font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Lock className="w-4 h-4" /> Match Credentials
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                                <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Room ID</div>
                                                <div className="text-white font-mono text-xl flex justify-between items-center">
                                                    {tournament.roomId || 'WAITING...'}
                                                    <button onClick={() => {
                                                        navigator.clipboard.writeText(tournament.roomId || '');
                                                        showToast("Copied!", "success");
                                                    }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                                        <ExternalLink className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                                <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Password</div>
                                                <div className="text-white font-mono text-xl flex justify-between items-center">
                                                    {showPassword ? (tournament.roomPass || '---') : '••••••'}
                                                    <div className="flex items-center">
                                                        <button 
                                                            onClick={() => setShowPassword(!showPassword)} 
                                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors relative z-20"
                                                        >
                                                            {showPassword ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                                                        </button>
                                                        <button onClick={() => {
                                                            navigator.clipboard.writeText(tournament.roomPass || '');
                                                            showToast("Copied!", "success");
                                                        }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                                            <ExternalLink className="w-4 h-4 text-gray-500" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'description' && (
                            <motion.div 
                                key="description"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                <div className="bg-surface p-8 rounded-3xl border border-gray-800">
                                    <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3 uppercase tracking-tighter">
                                        <Building2 className="w-6 h-6 text-brand-500" /> Organization
                                    </h3>
                                    {hostProfile ? (
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-dark border border-gray-700 overflow-hidden flex items-center justify-center">
                                                {hostProfile.profilePicUrl ? (
                                                    <img src={hostProfile.profilePicUrl || undefined} alt={hostProfile.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Building2 className="w-8 h-8 text-gray-600" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-white font-black text-lg">
                                                    <ProfileLink to={`/organization/${tournament.hostUid}`} name={hostProfile.username} />
                                                </div>
                                                <p className="text-gray-400 text-xs mt-1 line-clamp-2">{hostProfile.bio || 'No bio available.'}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <ProfileLink to={`/organization/${tournament.hostUid}`} name={tournament.hostName || 'Official Host'} />
                                    )}
                                </div>
                                <div className="bg-surface p-8 rounded-3xl border border-gray-800">
                                    <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3 uppercase tracking-tighter">
                                        <Medal className="w-6 h-6 text-brand-500" /> Prize Distribution
                                    </h3>
                                    <div className="space-y-3">
                                        {tournament.prizeDistribution?.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-dark rounded-xl border border-gray-800/50">
                                                <span className="text-sm text-gray-400 font-bold">Rank {p.rank}</span>
                                                <span className="text-sm font-black text-brand-400">{formatCurrency(p.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-surface p-8 rounded-3xl border border-gray-800">
                                    <h3 className="text-white font-black text-xl mb-6 flex items-center gap-3 uppercase tracking-tighter">
                                        <Lock className="w-6 h-6 text-brand-500" /> Rules & Regulations
                                    </h3>
                                    <div className="prose prose-invert max-w-none">
                                        <div className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                            {tournament.rules || 'No specific rules provided. Play fair and respect other players.'}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'participants' && (
                            <motion.div 
                                key="participants"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                    <h3 className="text-white font-black text-xl uppercase tracking-tighter">Registered Players</h3>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input 
                                            type="text" 
                                            placeholder="Search player or ID..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-surface border border-gray-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:border-brand-500 outline-none transition"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredParticipants.length > 0 ? filteredParticipants.map((p, i) => (
                                        <div key={i} className="bg-surface p-5 rounded-2xl border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-brand-500/30 transition-all shadow-lg hover:shadow-brand-500/5">
                                            <div className="flex items-start sm:items-center gap-4">
                                                <div className="w-12 h-12 shrink-0 bg-brand-600/10 rounded-2xl flex items-center justify-center text-brand-500 font-black border border-brand-500/20">
                                                    {i + 1}
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <div className="text-white font-black text-lg leading-none">
                                                        <ProfileLink to={`/profile/${p.userId}`} name={p.username} />
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="flex items-center gap-1.5 bg-dark px-2 py-1 rounded-lg border border-gray-800">
                                                            <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">UID:</span>
                                                            <span className="text-xs text-brand-400 font-mono font-bold">{p.inGameId}</span>
                                                        </div>
                                                        {p.inGameName && (
                                                            <div className="flex items-center gap-1.5 bg-dark px-2 py-1 rounded-lg border border-gray-800">
                                                                <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">IGN:</span>
                                                                <span className="text-xs text-brand-400 font-mono font-bold">{p.inGameName}</span>
                                                            </div>
                                                        )}
                                                        {p.teammates && p.teammates.map((tm: string, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-1.5 bg-dark px-2 py-1 rounded-lg border border-gray-800">
                                                                <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">T{idx + 1}:</span>
                                                                <span className="text-xs text-brand-400 font-mono font-bold">{tm}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right bg-dark sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border border-gray-800 sm:border-none">
                                                <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Team Name</div>
                                                <div className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-tight ${p.teamName ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20' : 'bg-gray-800 text-gray-500'}`}>
                                                    {p.teamId ? <ProfileLink to={`/team/${p.teamId}`} name={p.teamName || 'TEAM'} /> : (p.teamName || 'SOLO PLAYER')}
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="col-span-full py-12 text-center bg-surface rounded-3xl border border-gray-800 border-dashed">
                                            <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                            <p className="text-gray-500 font-bold">No participants yet. Be the first to join!</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'results' && (
                            <motion.div 
                                key="results"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                {tournament.status === 'completed' ? (
                                    <>
                                        <div className="bg-brand-600/10 border border-brand-500/30 p-8 rounded-3xl text-center">
                                            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Tournament Concluded</h3>
                                            <p className="text-gray-400 text-sm font-medium">Congratulations to all the winners!</p>
                                        </div>

                                        {tournament.winners && tournament.winners.length > 0 && (
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Hall of Fame</h4>
                                                {tournament.winners.map((winner, i) => (
                                                    <div key={i} className="bg-surface p-5 rounded-2xl border border-gray-800 flex items-center gap-6 relative overflow-hidden group">
                                                        {i === 0 && <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 blur-3xl rounded-full"></div>}
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${
                                                            i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                            i === 1 ? 'bg-gray-300/20 text-gray-300' :
                                                            i === 2 ? 'bg-orange-500/20 text-orange-500' :
                                                            'bg-gray-800 text-gray-500'
                                                        }`}>
                                                            {winner.rank}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-white font-black text-lg">{winner.username}</div>
                                                            <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Champion Rank</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-brand-400 font-black text-xl">{formatCurrency(winner.prize)}</div>
                                                            <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Prize Won</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {tournament.resultUrl && (
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Official Results</h4>
                                                <div className="rounded-3xl overflow-hidden border border-gray-800 shadow-2xl">
                                                    <img src={tournament.resultUrl || undefined} alt="Match Results" className="w-full h-auto" />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="py-20 text-center bg-surface rounded-3xl border border-gray-800 border-dashed">
                                        <Trophy className="w-16 h-16 text-gray-800 mx-auto mb-4" />
                                        <h3 className="text-xl font-black text-gray-600 uppercase tracking-tighter">Results Pending</h3>
                                        <p className="text-gray-500 text-sm mt-2">The tournament is still in progress.</p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {/* Related Tournaments */}
                    {relatedTournaments.length > 0 && (
                        <div className="space-y-6 pt-8 border-t border-gray-800/50">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Other {tournament.game} Events</h3>
                                <button onClick={() => navigate('/tournaments')} className="text-xs font-black text-brand-500 uppercase tracking-widest hover:text-brand-400 transition-colors flex items-center gap-1">
                                    View All <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {relatedTournaments.map((t) => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => navigate(`/details/${t.id}`)}
                                        className="bg-surface rounded-2xl border border-gray-800 overflow-hidden cursor-pointer group hover:border-brand-500/50 transition-all"
                                    >
                                        <div className="h-24 overflow-hidden relative">
                                            <img 
                                                src={t.bannerUrl || DEFAULT_BANNER || undefined} 
                                                alt={t.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent"></div>
                                        </div>
                                        <div className="p-4">
                                            <h4 className="text-white font-black text-sm truncate mb-1">{t.title}</h4>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-brand-500 font-black uppercase">{formatCurrency(t.prizePool)}</span>
                                                <span className="text-[10px] text-gray-500 font-bold">{formatDate(t.startTime)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Join Card */}
                    <div className="bg-surface p-8 rounded-3xl border border-gray-800 shadow-2xl sticky top-4">
                        {timeLeft && (
                            <div className="mb-8 text-center">
                                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3 flex items-center justify-center gap-2">
                                    <Clock className="w-3 h-3" /> Starts In
                                </div>
                                <div className="flex justify-center gap-3">
                                    {[
                                        { label: 'D', value: timeLeft.d },
                                        { label: 'H', value: timeLeft.h },
                                        { label: 'M', value: timeLeft.m },
                                        { label: 'S', value: timeLeft.s },
                                    ].map((t, i) => (
                                        <div key={i} className="flex flex-col items-center">
                                            <div className="w-12 h-12 bg-dark rounded-xl border border-gray-800 flex items-center justify-center text-xl font-black text-white shadow-inner">
                                                {t.value.toString().padStart(2, '0')}
                                            </div>
                                            <span className="text-[10px] text-gray-600 font-black mt-1">{t.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center p-4 bg-dark rounded-2xl border border-gray-800">
                                <span className="text-xs text-gray-500 font-black uppercase tracking-widest">Entry Fee</span>
                                <span className="text-xl font-black text-white">
                                    {tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : 'FREE'}
                                </span>
                            </div>
                            <div className="p-4 bg-dark rounded-2xl border border-gray-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-gray-500 font-black uppercase tracking-widest">Slots Filled</span>
                                    <span className="text-xs text-white font-black">{tournament.currentPlayers} / {tournament.slots}</span>
                                </div>
                                <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(tournament.currentPlayers / tournament.slots) * 100}%` }}
                                        className="bg-brand-600 h-full rounded-full shadow-[0_0_10px_rgba(var(--brand-primary-rgb),0.5)]"
                                    ></motion.div>
                                </div>
                            </div>
                        </div>

                        {tournament.status === 'completed' ? (
                            <button 
                                onClick={() => setActiveTab('results')}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                <Trophy className="w-6 h-6" /> View Results
                            </button>
                        ) : !user ? (
                            <button 
                                onClick={() => navigate('/profile')}
                                className="w-full bg-gray-800 hover:bg-gray-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                                Login to Join
                            </button>
                        ) : isJoined ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setActiveTab('overview')}
                                        className="bg-dark hover:bg-gray-800 text-gray-400 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-800 transition-all"
                                    >
                                        Room Access
                                    </button>
                                    <button 
                                        onClick={() => window.open('https://discord.gg', '_blank')}
                                        className="bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-brand-500/20 transition-all"
                                    >
                                        Join Discord
                                    </button>
                                </div>
                            </div>
                        ) : tournament.currentPlayers >= tournament.slots ? (
                            <button disabled className="w-full bg-red-900/20 text-red-500 border border-red-900/50 py-5 rounded-2xl font-black uppercase tracking-widest cursor-not-allowed">
                                Tournament Full
                            </button>
                        ) : tournament.status !== 'upcoming' ? (
                            <button disabled className="w-full bg-gray-900 text-gray-600 py-5 rounded-2xl font-black uppercase tracking-widest cursor-not-allowed border border-gray-800">
                                Registration Closed
                            </button>
                        ) : (
                            <button 
                                onClick={handleJoinClick}
                                className="w-full bg-brand-600 hover:bg-brand-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-all active:scale-95 flex items-center justify-center gap-3 group"
                            >
                                Join Tournament <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showJoinModal && tournament && (
                <Modal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} title={`Join ${tournament.teamType.toUpperCase()} Tournament`}>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-400 mb-4">Please provide the in-game names of your teammates.</p>
                        
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Teammate 1 In-Game Name</label>
                            {teamMembers.length > 0 ? (
                                <select 
                                    value={teammate1}
                                    onChange={(e) => setTeammate1(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold"
                                >
                                    <option value="">Select a teammate</option>
                                    {teamMembers.map(m => (
                                        <option key={m.userId} value={m.inGameName || m.username}>{m.inGameName || m.username}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type="text" 
                                    value={teammate1}
                                    onChange={(e) => setTeammate1(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold"
                                    placeholder="Enter in-game name"
                                />
                            )}
                        </div>

                        {tournament.teamType === 'squad' && (
                            <>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Teammate 2 In-Game Name</label>
                                    {teamMembers.length > 0 ? (
                                        <select 
                                            value={teammate2}
                                            onChange={(e) => setTeammate2(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold"
                                        >
                                            <option value="">Select a teammate</option>
                                            {teamMembers.map(m => (
                                                <option key={m.userId} value={m.inGameName || m.username}>{m.inGameName || m.username}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={teammate2}
                                            onChange={(e) => setTeammate2(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold"
                                            placeholder="Enter in-game name"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Teammate 3 In-Game Name</label>
                                    {teamMembers.length > 0 ? (
                                        <select 
                                            value={teammate3}
                                            onChange={(e) => setTeammate3(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold"
                                        >
                                            <option value="">Select a teammate</option>
                                            {teamMembers.map(m => (
                                                <option key={m.userId} value={m.inGameName || m.username}>{m.inGameName || m.username}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={teammate3}
                                            onChange={(e) => setTeammate3(e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded-xl p-4 text-white focus:border-brand-500 outline-none font-bold"
                                            placeholder="Enter in-game name"
                                        />
                                    )}
                                </div>
                            </>
                        )}

                        <div className="pt-4 flex gap-3">
                            <button onClick={() => setShowJoinModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition uppercase text-sm">
                                Cancel
                            </button>
                            <button onClick={handleJoinSubmit} className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition uppercase text-sm">
                                Confirm Join
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default TournamentDetails;
