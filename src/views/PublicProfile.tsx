import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { UserProfile, Team, Tournament, OrgPost, MatchHistory } from '../types';
import { Shield, Trophy, Briefcase, Users, ArrowLeft, CheckCircle2, Copy, UserPlus, UserMinus, Calendar, Share2, Eye, MessageSquare, Plus, Star, Activity, Award, Zap, ChevronRight } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/Modal';
import { formatDate, timeAgo } from '../utils';
import { motion } from 'motion/react';

const PublicProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useNotification();
    
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [orgPosts, setOrgPosts] = useState<OrgPost[]>([]);
    const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followId, setFollowId] = useState<string | null>(null);
    const [followLoading, setFollowLoading] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);

    // Create Post Modal State
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [postTitle, setPostTitle] = useState('');
    const [postContent, setPostContent] = useState('');
    const [postImageUrl, setPostImageUrl] = useState('');
    const [isCreatingPost, setIsCreatingPost] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // 1. Fetch Profile
                const userDoc = await getDoc(doc(db, 'users_public', id));
                if (!userDoc.exists()) {
                    showToast('User not found', 'error');
                    setLoading(false);
                    return;
                }
                const profileData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
                setProfile(profileData);

                const promises: Promise<any>[] = [];

                // 2. Fetch Teams
                promises.push(getDocs(query(collection(db, 'team_members'), where('userId', '==', id))).then(async (memberSnap) => {
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
                }));

                // 3. Fetch Tournaments
                promises.push(getDocs(query(collection(db, 'tournaments'), where('hostUid', '==', id))).then(snap => {
                    setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));
                }));

                // 4. Fetch Match History
                promises.push(getDocs(query(collection(db, 'match_history'), where('userId', '==', id))).then(snap => {
                    const matches = snap.docs.map(d => ({ id: d.id, ...d.data() } as MatchHistory));
                    matches.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
                    setMatchHistory(matches);
                }));

                // 5. Fetch Follow Data
                promises.push(getDocs(query(collection(db, 'follows'), where('followingId', '==', id))).then(snap => setFollowerCount(snap.size)));
                promises.push(getDocs(query(collection(db, 'follows'), where('followerId', '==', id))).then(snap => setFollowingCount(snap.size)));

                if (user && user.uid !== id) {
                    promises.push(getDocs(query(collection(db, 'follows'), where('followerId', '==', user.uid), where('followingId', '==', id))).then(snap => {
                        if (!snap.empty) {
                            setIsFollowing(true);
                            setFollowId(snap.docs[0].id);
                        }
                    }));
                }

                // 6. Fetch Org Posts
                if (profileData.role === 'organizer') {
                    promises.push(getDocs(query(collection(db, 'org_posts'), where('orgId', '==', id))).then(snap => {
                        const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as OrgPost));
                        posts.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                        setOrgPosts(posts);
                    }));
                }

                await Promise.all(promises);

            } catch (error) {
                console.error("Error fetching profile data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [id, user]);

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !profile || !postTitle.trim() || !postContent.trim()) return;
        
        setIsCreatingPost(true);
        try {
            const newPost = {
                orgId: user.uid,
                orgName: profile.orgName || profile.username,
                orgAvatar: profile.profilePicUrl || '',
                title: postTitle.trim(),
                content: postContent.trim(),
                imageUrl: postImageUrl.trim(),
                createdAt: serverTimestamp()
            };
            
            const docRef = await addDoc(collection(db, 'org_posts'), newPost);
            setOrgPosts(prev => [{ id: docRef.id, ...newPost, createdAt: serverTimestamp() } as OrgPost, ...prev]);
            
            showToast('Announcement posted successfully!', 'success');
            setShowCreatePost(false);
            setPostTitle('');
            setPostContent('');
            setPostImageUrl('');
        } catch (error) {
            console.error("Error creating post:", error);
            showToast('Failed to create post', 'error');
        } finally {
            setIsCreatingPost(false);
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

    const isRankOne = profile.rank === '1' || profile.points === 10000; // Mock check for #1

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-20 px-4">
            <Helmet>
                <title>{profile.username} | NexPlay Profile</title>
            </Helmet>

            {/* Breadcrumbs & Back Button */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500">
                    <Link to="/leaderboard" className="hover:text-brand-400 transition">Leaderboard</Link>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-white">Player Profile</span>
                </div>
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest transition"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>
            </div>

            {/* Profile Hero Section */}
            <div className="bg-card rounded-3xl border border-gray-800 overflow-hidden shadow-2xl mb-8 relative">
                <div 
                    className="h-48 bg-gradient-to-r from-brand-900 via-purple-900 to-black relative bg-cover bg-center"
                    style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : {}}
                >
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
                    <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                </div>
                
                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col md:flex-row items-end gap-8 -mt-16 relative z-10">
                        <div className="relative">
                            <div className={`w-40 h-40 rounded-3xl border-4 ${isRankOne ? 'border-yellow-500 shadow-yellow-500/20' : 'border-card'} bg-dark overflow-hidden shadow-2xl flex items-center justify-center bg-gradient-to-br from-brand-600 to-purple-800 text-5xl font-black text-white`}>
                                {profile.profilePicUrl ? (
                                    <img src={profile.profilePicUrl || undefined} className="w-full h-full object-cover" alt="Avatar" />
                                ) : (
                                    profile.username[0].toUpperCase()
                                )}
                            </div>
                            {isRankOne && (
                                <div className="absolute -top-4 -right-4 bg-yellow-500 text-black p-2 rounded-full shadow-lg border-4 border-card">
                                    <Star className="w-6 h-6 fill-current" />
                                </div>
                            )}
                            <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-card ${getStatusColor(profile.status || 'online')}`}></div>
                        </div>

                        <div className="flex-grow pb-2 w-full">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-4xl font-black text-white tracking-tight">{profile.username}</h1>
                                        {profile.isVerified && <CheckCircle2 className="w-6 h-6 text-blue-400 fill-blue-400/10" />}
                                        {profile.isChampion && <Award className="w-6 h-6 text-yellow-500" />}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3 mb-4">
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-brand-500/20 text-brand-400 px-3 py-1 rounded-full border border-brand-500/30 flex items-center gap-1">
                                            <Zap className="w-3 h-3" /> Rank #{profile.rank || 'Unranked'}
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-700">
                                            {profile.role}
                                        </span>
                                        <button onClick={handleCopyId} className="text-[10px] font-mono text-gray-500 hover:text-white transition bg-dark px-3 py-1 rounded-full border border-gray-800 flex items-center gap-2">
                                            ID: {id?.slice(0, 8)}... {copiedId ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-6 text-sm font-bold text-gray-400">
                                        <div className="flex items-center gap-2"><Users className="w-4 h-4" /> <span className="text-white">{followerCount}</span> Followers</div>
                                        <div className="flex items-center gap-2"><Activity className="w-4 h-4" /> <span className="text-white">{followingCount}</span> Following</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {user && user.uid !== id && (
                                        <button 
                                            onClick={handleToggleFollow}
                                            disabled={followLoading}
                                            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition shadow-xl flex items-center gap-2 ${
                                                isFollowing 
                                                    ? 'bg-gray-800 hover:bg-red-900/50 text-gray-300 hover:text-red-400 border border-gray-700' 
                                                    : 'bg-brand-600 hover:bg-brand-500 text-white'
                                            }`}
                                        >
                                            {isFollowing ? <><UserMinus className="w-4 h-4" /> Unfollow</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                                        </button>
                                    )}
                                    <button className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl transition border border-gray-700">
                                        <Share2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Points', value: profile.points || 0, icon: Star, color: 'text-yellow-500' },
                    { label: 'Wins', value: profile.wins || 0, icon: Trophy, color: 'text-brand-500' },
                    { label: 'Win Rate', value: `${profile.winRate || 0}%`, icon: Activity, color: 'text-green-500' },
                    { label: 'Tournaments', value: profile.tournamentsPlayed || 0, icon: Calendar, color: 'text-blue-500' }
                ].map((stat, i) => (
                    <div key={i} className="bg-card p-6 rounded-3xl border border-gray-800 shadow-lg hover:border-gray-700 transition group">
                        <div className={`p-2 rounded-xl bg-white/5 w-fit mb-3 group-hover:scale-110 transition-transform`}>
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-2xl font-black text-white">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Match History */}
                    <div className="bg-card rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                            <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-5 h-5 text-brand-500" /> Recent Matches
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-800">
                            {matchHistory.length > 0 ? (
                                matchHistory.map((match) => (
                                    <div key={match.id} className="p-6 hover:bg-white/5 transition flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black uppercase text-xs ${match.result === 'victory' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                                                {match.result === 'victory' ? 'Win' : 'Loss'}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white group-hover:text-brand-400 transition">{match.tournamentName}</h4>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{timeAgo(match.timestamp?.toDate())}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8 text-right">
                                            <div>
                                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Kills</p>
                                                <p className="font-black text-white">{match.kills}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Prize</p>
                                                <p className="font-black text-brand-400">NPR {match.prize.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-12 text-center">
                                    <Activity className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No match history found</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Announcements for Organizers */}
                    {profile.role === 'organizer' && (
                        <div className="bg-card rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                                <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-brand-500" /> Announcements
                                </h3>
                                {user?.uid === id && (
                                    <button 
                                        onClick={() => setShowCreatePost(true)}
                                        className="bg-brand-500 hover:bg-brand-400 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> Create Post
                                    </button>
                                )}
                            </div>
                            <div className="p-6 space-y-6">
                                {orgPosts.map(post => (
                                    <div key={post.id} className="bg-dark p-6 rounded-2xl border border-gray-800 hover:border-gray-700 transition group">
                                        <h4 className="text-xl font-black text-white mb-2 group-hover:text-brand-400 transition">{post.title}</h4>
                                        <p className="text-gray-400 text-sm leading-relaxed mb-4">{post.content}</p>
                                        {post.imageUrl && (
                                            <img src={post.imageUrl} alt="Post" className="w-full h-48 object-cover rounded-xl mb-4" />
                                        )}
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                                            <span>{formatDate(post.createdAt)}</span>
                                            <div className="flex items-center gap-4">
                                                <button className="hover:text-white transition flex items-center gap-1"><Eye className="w-3 h-3" /> 1.2k</button>
                                                <button className="hover:text-white transition flex items-center gap-1"><MessageSquare className="w-3 h-3" /> 42</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-8">
                    {/* About Section */}
                    <div className="bg-card p-6 rounded-3xl border border-gray-800 shadow-xl">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-brand-500" /> About
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            {profile.bio || 'This elite player prefers to let their gameplay do the talking.'}
                        </p>
                        {profile.skills && profile.skills.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {profile.skills.map((skill, i) => (
                                    <span key={i} className="bg-dark border border-gray-800 text-brand-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Teams Section */}
                    <div className="bg-card p-6 rounded-3xl border border-gray-800 shadow-xl">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-brand-500" /> Teams
                        </h3>
                        <div className="space-y-3">
                            {teams.length > 0 ? (
                                teams.map(team => (
                                    <Link to={`/team/${team.id}`} key={team.id} className="flex items-center gap-3 bg-dark p-3 rounded-2xl border border-gray-800 hover:border-brand-500/50 transition group">
                                        <div className="w-12 h-12 rounded-xl bg-gray-800 overflow-hidden flex items-center justify-center shrink-0 border border-gray-700">
                                            {team.logoUrl ? <img src={team.logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-gray-600" />}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-white text-sm group-hover:text-brand-400 transition">{team.name}</h4>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{team.region || 'Global'}</p>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <p className="text-gray-500 text-sm italic">Not currently affiliated with a team.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Post Modal */}
            <Modal isOpen={showCreatePost} onClose={() => setShowCreatePost(false)} title="Create Announcement">
                <form onSubmit={handleCreatePost} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Title</label>
                        <input
                            type="text"
                            value={postTitle}
                            onChange={(e) => setPostTitle(e.target.value)}
                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition font-bold"
                            placeholder="Announcement Title"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Content</label>
                        <textarea
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition h-32 resize-none text-sm"
                            placeholder="Write your announcement here..."
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Image URL (Optional)</label>
                        <input
                            type="url"
                            value={postImageUrl}
                            onChange={(e) => setPostImageUrl(e.target.value)}
                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition font-mono text-sm"
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-800">
                        <button
                            type="button"
                            onClick={() => setShowCreatePost(false)}
                            className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreatingPost || !postTitle.trim() || !postContent.trim()}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest transition shadow-lg disabled:opacity-50"
                        >
                            {isCreatingPost ? 'Posting...' : 'Post Announcement'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PublicProfile;
