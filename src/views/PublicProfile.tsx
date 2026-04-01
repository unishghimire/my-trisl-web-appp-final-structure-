import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { UserProfile, Team } from '../types';
import { Shield, Trophy, Briefcase, Users, ArrowLeft, CheckCircle2, Copy, UserPlus, UserMinus } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const PublicProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { showToast } = useNotification();
    
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followId, setFollowId] = useState<string | null>(null);
    const [followLoading, setFollowLoading] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [stats, setStats] = useState({ tournamentsJoined: 0, totalWinnings: 0, winRate: 0 });

    useEffect(() => {
        if (id) {
            fetchProfileData();
            fetchStats();
        }
    }, [id]);

    const fetchStats = async () => {
        if (!id) return;
        try {
            // Tournaments joined
            const partQ = query(collection(db, 'participants'), where('userId', '==', id));
            const partSnap = await getDocs(partQ);
            const tournamentsJoined = partSnap.size;

            // Total winnings
            const txQ = query(collection(db, 'transactions'), where('userId', '==', id), where('type', '==', 'prize'));
            const txSnap = await getDocs(txQ);
            let totalWinnings = 0;
            txSnap.forEach(doc => totalWinnings += doc.data().amount);

            // Win Rate (approximate - based on prize transactions)
            const winRate = tournamentsJoined > 0 ? (txSnap.size / tournamentsJoined) * 100 : 0;

            setStats({ tournamentsJoined, totalWinnings, winRate });
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    const fetchProfileData = async () => {
        setLoading(true);
        try {
            if (!id) return;
            
            // Fetch public profile
            const userDoc = await getDoc(doc(db, 'users_public', id));
            if (userDoc.exists()) {
                setProfile({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
            } else {
                showToast('User not found', 'error');
                return;
            }

            // Fetch teams user belongs to
            const memberQ = query(collection(db, 'team_members'), where('userId', '==', id));
            const memberSnap = await getDocs(memberQ);
            const teamIds = memberSnap.docs.map(d => d.data().teamId);
            
            if (teamIds.length > 0) {
                const teamsData: Team[] = [];
                for (const teamId of teamIds) {
                    const teamDoc = await getDoc(doc(db, 'teams', teamId));
                    if (teamDoc.exists()) {
                        teamsData.push({ id: teamDoc.id, ...teamDoc.data() } as Team);
                    }
                }
                setTeams(teamsData);
            }

            // Check if following
            if (user && user.uid !== id) {
                const followQ = query(collection(db, 'follows'), where('followerId', '==', user.uid), where('followingId', '==', id));
                const followSnap = await getDocs(followQ);
                if (!followSnap.empty) {
                    setIsFollowing(true);
                    setFollowId(followSnap.docs[0].id);
                }
            }

            // Get counts
            const followersQ = query(collection(db, 'follows'), where('followingId', '==', id));
            const followersSnap = await getDocs(followersQ);
            setFollowerCount(followersSnap.size);

            const followingQ = query(collection(db, 'follows'), where('followerId', '==', id));
            const followingSnap = await getDocs(followingQ);
            setFollowingCount(followingSnap.size);

        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFollow = async () => {
        if (!user || !id) return;
        setFollowLoading(true);
        try {
            if (isFollowing && followId) {
                await deleteDoc(doc(db, 'follows', followId));
                setIsFollowing(false);
                setFollowId(null);
                setFollowerCount(prev => prev - 1);
                showToast('Unfollowed user', 'info');
            } else {
                const docRef = await addDoc(collection(db, 'follows'), {
                    followerId: user.uid,
                    followingId: id,
                    createdAt: serverTimestamp()
                });
                setIsFollowing(true);
                setFollowId(docRef.id);
                setFollowerCount(prev => prev + 1);
                showToast('Following user', 'success');
                
                // Send notification
                await addDoc(collection(db, 'notifications'), {
                    userId: id,
                    title: 'New Follower',
                    message: `${user.username} is now following you`,
                    type: 'info',
                    read: false,
                    link: `/user/${user.uid}`,
                    timestamp: serverTimestamp()
                });
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
            showToast('Failed to update follow status', 'error');
        } finally {
            setFollowLoading(false);
        }
    };

    const handleCopyId = () => {
        if (id) {
            navigator.clipboard.writeText(id);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
            showToast('User ID copied to clipboard', 'success');
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'online': return 'bg-green-500';
            case 'idle': return 'bg-yellow-500';
            case 'dnd': return 'bg-red-500';
            case 'offline': return 'bg-gray-500';
            default: return 'bg-green-500';
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Profile...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-4">User Not Found</h2>
                <Link to="/" className="text-brand-500 hover:text-brand-400 font-bold flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto animate-fade-in pb-20">
            {/* Header Card */}
            <div className="bg-card rounded-2xl border border-gray-800 overflow-hidden shadow-2xl mb-6">
                <div 
                    className="h-32 bg-gradient-to-r from-brand-900 via-purple-900 to-black relative bg-cover bg-center"
                    style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : {}}
                >
                    <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                </div>
                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col md:flex-row items-end gap-6 -mt-12 relative z-10">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-2xl border-4 border-card bg-dark overflow-hidden shadow-xl flex items-center justify-center bg-gradient-to-br from-brand-600 to-purple-800 text-4xl font-black text-white relative">
                                {profile.profilePicUrl ? (
                                    <img src={profile.profilePicUrl} className="w-full h-full object-cover" alt="Avatar" />
                                ) : (
                                    profile.username[0].toUpperCase()
                                )}
                            </div>
                            <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-card ${getStatusColor(profile.status || 'online')}`}></div>
                        </div>
                        <div className="flex-grow pb-2 w-full">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-3xl font-black text-white tracking-tight">{profile.username}</h2>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs text-gray-500 font-mono bg-dark px-2 py-1 rounded border border-gray-800 flex items-center gap-2">
                                            ID: {id}
                                            <button onClick={handleCopyId} className="hover:text-white transition">
                                                {copiedId ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                        </span>
                                        {profile.customActivity && (
                                            <span className="text-xs text-brand-300 bg-brand-500/10 px-2 py-1 rounded border border-brand-500/20">
                                                {profile.customActivity}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm font-bold text-gray-400">
                                        <div><span className="text-white">{followerCount}</span> Followers</div>
                                        <div><span className="text-white">{followingCount}</span> Following</div>
                                    </div>
                                </div>
                                {user && user.uid !== id && (
                                    <button 
                                        onClick={handleToggleFollow}
                                        disabled={followLoading}
                                        className={`shrink-0 px-6 py-2 rounded-xl font-black uppercase tracking-widest text-xs transition shadow-lg flex items-center gap-2 ${
                                            isFollowing 
                                                ? 'bg-gray-800 hover:bg-red-900/50 text-gray-300 hover:text-red-400 border border-gray-700 hover:border-red-500/50' 
                                                : 'bg-brand-600 hover:bg-brand-500 text-white'
                                        }`}
                                    >
                                        {isFollowing ? (
                                            <><UserMinus className="w-4 h-4" /> Unfollow</>
                                        ) : (
                                            <><UserPlus className="w-4 h-4" /> Follow</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    {/* Bio & Skills */}
                    <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-lg backdrop-blur-md bg-white/5">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">About</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            {profile.bio || 'This user has not provided a bio yet.'}
                        </p>
                        
                        {profile.skills && profile.skills.length > 0 && (
                            <div>
                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4" /> Skills
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {profile.skills.map((skill, index) => (
                                        <span key={index} className="bg-dark border border-gray-700 text-brand-400 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Teams */}
                    <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-lg backdrop-blur-md bg-white/5">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 border-b border-gray-800 pb-2 flex items-center gap-2">
                            <Users className="w-5 h-5 text-brand-500" /> Teams
                        </h3>
                        {teams.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {teams.map(team => (
                                    <Link to={`/team/${team.id}`} key={team.id} className="flex items-center gap-3 bg-dark p-3 rounded-xl border border-gray-800 hover:border-brand-500/50 transition group">
                                        <div className="w-10 h-10 rounded-lg bg-gray-800 overflow-hidden flex items-center justify-center shrink-0">
                                            {team.logoUrl ? (
                                                <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Users className="w-5 h-5 text-gray-600" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-white text-sm group-hover:text-brand-400 transition line-clamp-1">{team.name}</h4>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">Not a member of any teams yet.</p>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Stats */}
                    <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-lg backdrop-blur-md bg-white/5">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 border-b border-gray-800 pb-2 flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-brand-500" /> Stats
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-dark p-3 rounded-xl border border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Tournaments Joined</div>
                                <div className="text-xl font-black text-white">{stats.tournamentsJoined}</div>
                            </div>
                            <div className="bg-dark p-3 rounded-xl border border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Total Winnings</div>
                                <div className="text-xl font-black text-white">Rs. {stats.totalWinnings}</div>
                            </div>
                            <div className="bg-dark p-3 rounded-xl border border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Win Rate</div>
                                <div className="text-xl font-black text-white">{stats.winRate.toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>

                    {/* Game Info */}
                    <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-lg backdrop-blur-md bg-white/5">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">Game Info</h3>
                        <div className="space-y-4">
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">In-Game ID</span>
                                <div className="font-mono text-white bg-dark px-3 py-2 rounded-lg border border-gray-800 text-sm">
                                    {profile.inGameId || 'Not provided'}
                                </div>
                            </div>
                            {profile.inGameName && (
                                <div>
                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">In-Game Name</span>
                                    <div className="font-mono text-white bg-dark px-3 py-2 rounded-lg border border-gray-800 text-sm">
                                        {profile.inGameName}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicProfile;
