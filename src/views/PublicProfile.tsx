import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { UserProfile, Team, Tournament, OrgPost } from '../types';
import { Shield, Trophy, Briefcase, Users, ArrowLeft, CheckCircle2, Copy, UserPlus, UserMinus, Calendar, Share2, Eye, MessageSquare, Plus } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/Modal';
import { formatDate } from '../utils';

const PublicProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { showToast } = useNotification();
    
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [orgPosts, setOrgPosts] = useState<OrgPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followId, setFollowId] = useState<string | null>(null);
    const [followLoading, setFollowLoading] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [stats, setStats] = useState({ tournamentsJoined: 0, totalWinnings: 0, winRate: 0 });

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

                // 4. Fetch Stats
                promises.push(getDocs(query(collection(db, 'participants'), where('userId', '==', id))).then(partSnap => {
                    const tournamentsJoined = partSnap.size;
                    getDocs(query(collection(db, 'transactions'), where('userId', '==', id), where('type', '==', 'prize'))).then(txSnap => {
                        let totalWinnings = 0;
                        txSnap.forEach(doc => totalWinnings += doc.data().amount);
                        const winRate = tournamentsJoined > 0 ? (txSnap.size / tournamentsJoined) * 100 : 0;
                        setStats({ tournamentsJoined, totalWinnings, winRate });
                    });
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
                        // Sort locally since we don't have a composite index for orgId + createdAt yet
                        posts.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
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
            
            // Add to local state
            setOrgPosts(prev => [{ id: docRef.id, ...newPost, createdAt: { seconds: Date.now() / 1000 } } as OrgPost, ...prev]);
            
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
            <Helmet>
                <title>{profile.username} | NexPlay Profile</title>
                <meta name="description" content={`View ${profile.username}'s profile on NexPlay. Tournaments joined: ${stats.tournamentsJoined}.`} />
            </Helmet>
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
                                    <img src={profile.profilePicUrl || undefined} className="w-full h-full object-cover" alt="Avatar" />
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
                                            <button onClick={handleCopyId} aria-label="Copy User ID" className="hover:text-white transition">
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
                                {user && user.uid !== id && profile.role === 'organizer' && (
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
                                                <img src={team.logoUrl || undefined} alt={team.name} className="w-full h-full object-cover" />
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

                    {/* Announcements (Org Posts) */}
                    {profile.role === 'organizer' && (
                        <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-lg backdrop-blur-md bg-white/5">
                            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                                <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-brand-500" /> Announcements
                                </h3>
                                {user?.uid === id && (
                                    <button 
                                        onClick={() => setShowCreatePost(true)}
                                        className="bg-brand-500 hover:bg-brand-400 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Create Post
                                    </button>
                                )}
                            </div>
                            
                            {orgPosts.length > 0 ? (
                                <div className="space-y-4">
                                    {orgPosts.map(post => (
                                        <Link to={`/post/${post.id}`} key={post.id} className="block bg-dark p-5 rounded-xl border border-gray-700 shadow-lg hover:border-brand-500/50 transition group">
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="font-black text-white text-lg group-hover:text-brand-400 transition line-clamp-1">{post.title}</h4>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1 shrink-0">
                                                    <Calendar className="w-3 h-3" /> {formatDate(post.createdAt)}
                                                </div>
                                            </div>
                                            <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                                                {post.content}
                                            </p>
                                            {post.imageUrl && (
                                                <div className="w-full h-32 rounded-lg overflow-hidden mb-4">
                                                    <img src={post.imageUrl || undefined} alt="Post Attachment" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className="text-brand-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                                Read More <ArrowLeft className="w-3 h-3 rotate-180" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-dark rounded-xl border border-gray-800 border-dashed">
                                    <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                                    <p className="text-gray-500 text-sm">No announcements yet.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tournaments Hosted */}
                    {profile.role === 'organizer' && (
                        <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-lg backdrop-blur-md bg-white/5">
                            <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 border-b border-gray-800 pb-2 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-brand-500" /> Tournaments
                            </h3>
                            {tournaments.length > 0 ? (
                                <div className="space-y-4">
                                    {tournaments.map(t => (
                                        <div key={t.id} className="bg-dark p-5 rounded-xl border border-gray-700 shadow-lg relative overflow-hidden group">
                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className="bg-gray-800 text-gray-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-700">{t.game}</span>
                                                            <span className="bg-brand-600/20 text-brand-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-brand-500/20 uppercase">{t.teamType}</span>
                                                            <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-500/20 uppercase">{t.type}</span>
                                                        </div>
                                                        <h4 className="font-black text-white text-sm group-hover:text-brand-400 transition cursor-pointer" onClick={() => window.location.href = `/details/${t.id}`}>
                                                            {t.title}
                                                        </h4>
                                                        <div className="text-xs text-gray-400 mt-1">{new Date(t.startTime.seconds * 1000).toLocaleDateString()}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-brand-400 font-bold text-sm">Rs. {t.prizePool}</div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex gap-3 text-sm border-t border-gray-700 pt-3">
                                                    <Link to={`/details/${t.id}`} className="text-gray-300 hover:text-white flex items-center gap-1">
                                                        <Eye className="w-4 h-4" /> Details
                                                    </Link>
                                                    <button onClick={() => {
                                                        navigator.clipboard.writeText(`${window.location.origin}/details/${t.id}`);
                                                        showToast('Tournament link copied to clipboard', 'success');
                                                    }} className="text-gray-300 hover:text-white flex items-center gap-1">
                                                        <Share2 className="w-4 h-4" /> Share
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm">No tournaments hosted yet.</p>
                            )}
                        </div>
                    )}
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

            {/* Create Post Modal */}
            <Modal isOpen={showCreatePost} onClose={() => setShowCreatePost(false)} title="Create Announcement">
                <form onSubmit={handleCreatePost} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Title</label>
                        <input
                            type="text"
                            value={postTitle}
                            onChange={(e) => setPostTitle(e.target.value)}
                            className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500 transition"
                            placeholder="Announcement Title"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Content</label>
                        <textarea
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500 transition h-32 resize-none"
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
                            className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500 transition"
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={() => setShowCreatePost(false)}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreatingPost || !postTitle.trim() || !postContent.trim()}
                            className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition disabled:opacity-50 disabled:cursor-not-allowed"
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
