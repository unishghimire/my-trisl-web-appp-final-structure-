import React, { useState, useRef, useEffect } from 'react';
import { doc, updateDoc, writeBatch, serverTimestamp, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateEmail, sendPasswordResetEmail } from 'firebase/auth';
import { db, storage, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatCurrency, formatDate } from '../utils';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { useInvisibleImage } from '../hooks/useInvisibleImage';
import { DEFAULT_AVATAR, NEXPLAY_LOGO, PRESET_AVATARS, PRESET_PLAYER_BANNERS } from '../constants';
import { User, Mail, Phone, Shield, Trophy, Wallet as WalletIcon, Camera, Save, Info, Briefcase, Users, Hash, Clock, ArrowDown, ArrowUp, Copy, CheckCircle2, Image as ImageIcon, Settings as SettingsIcon } from 'lucide-react';
import { Transaction } from '../types';
import imageCompression from 'browser-image-compression';

const Profile: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'settings' | 'activity'>('settings');
    const [recentActivity, setRecentActivity] = useState<Transaction[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);

    const [inGameId, setInGameId] = useState(profile?.inGameId || '');
    const [inGameName, setInGameName] = useState(profile?.inGameName || '');
    const [teamName, setTeamName] = useState(profile?.teamName || '');
    const [phone, setPhone] = useState(profile?.phone || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [skills, setSkills] = useState<string>(profile?.skills?.join(', ') || '');
    const [status, setStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>(profile?.status || 'online');
    const [customActivity, setCustomActivity] = useState(profile?.customActivity || '');
    const [orgName, setOrgName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [showBannerPresetModal, setShowBannerPresetModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

    const { handlePaste, handleDrop, handleDragOver } = useInvisibleImage({
        folder: `profiles/${user?.uid}`,
        onUploadStart: () => setIsUploading(true),
        onUploadEnd: () => setIsUploading(false),
        onUploadSuccess: async (url) => {
            if (!user) return;
            await updateDoc(doc(db, 'users', user.uid), {
                profilePicUrl: url
            });
            showToast('Profile picture updated!', 'success');
        }
    });

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    useEffect(() => {
        if (user) {
            const fetchFollowCounts = async () => {
                try {
                    const followersQ = query(collection(db, 'follows'), where('followingId', '==', user.uid));
                    const followersSnap = await getDocs(followersQ);
                    setFollowerCount(followersSnap.size);

                    const followingQ = query(collection(db, 'follows'), where('followerId', '==', user.uid));
                    const followingSnap = await getDocs(followingQ);
                    setFollowingCount(followingSnap.size);
                } catch (error) {
                    console.error("Error fetching follow counts:", error);
                }
            };
            fetchFollowCounts();
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'activity' && user) {
            const fetchActivity = async () => {
                setLoadingActivity(true);
                try {
                    const q = query(
                        collection(db, 'transactions'),
                        where('userId', '==', user.uid),
                        orderBy('timestamp', 'desc'),
                        limit(10)
                    );
                    const snap = await getDocs(q);
                    setRecentActivity(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
                } catch (error) {
                    console.error("Error fetching activity:", error);
                } finally {
                    setLoadingActivity(false);
                }
            };
            fetchActivity();
        }
    }, [activeTab, user]);

    if (!profile) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Profile...</p>
        </div>
    );

    const isUidLocked = profile.inGameId && profile.inGameId.trim().length > 0;

    const handleSave = async () => {
        if (!user) return;

        if (!inGameId.trim() || !inGameName.trim() || !phone.trim()) {
            showToast('In-Game ID, In-Game Name, and Phone Number are required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const userRef = doc(db, 'users', user.uid);
            const publicRef = doc(db, 'users_public', user.uid);

            batch.update(userRef, {
                inGameId: inGameId,
                inGameName: inGameName,
                teamName: teamName,
                phone: phone,
                bio: bio,
                skills: skills.split(',').map(s => s.trim()).filter(s => s),
                status: status,
                customActivity: customActivity,
                updatedAt: serverTimestamp()
            });

            batch.set(publicRef, {
                inGameId: inGameId,
                inGameName: inGameName,
                username: profile.username,
                profilePicUrl: profile.profilePicUrl || '',
                skills: skills.split(',').map(s => s.trim()).filter(s => s),
                status: status,
                customActivity: customActivity,
                updatedAt: serverTimestamp()
            }, { merge: true });

            await batch.commit();
            showToast('Profile updated!', 'success');
        } catch (error) {
            console.error("Error updating profile:", error);
            showToast('Error saving profile', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOrgApply = async () => {
        if (!user || !orgName) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                orgStatus: 'pending',
                orgName: orgName
            });
            showToast('Application sent! Admin will review your request.', 'success');
        } catch (error) {
            console.error("Error applying for organizer:", error);
            showToast('Failed to send application', 'error');
        }
    };

    const handleCopyId = () => {
        if (user?.uid) {
            navigator.clipboard.writeText(user.uid);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
            showToast('User ID copied to clipboard', 'success');
        }
    };

    const handleUpdateEmail = async () => {
        if (!auth.currentUser || !newEmail) return;
        setIsUpdatingEmail(true);
        try {
            await updateEmail(auth.currentUser, newEmail);
            await updateDoc(doc(db, 'users', user!.uid), { email: newEmail });
            showToast('Email updated successfully!', 'success');
            setNewEmail('');
        } catch (error: any) {
            console.error("Error updating email:", error);
            if (error.code === 'auth/requires-recent-login') {
                showToast('Please log out and log back in to change your email.', 'error');
            } else {
                showToast(error.message || 'Failed to update email', 'error');
            }
        } finally {
            setIsUpdatingEmail(false);
        }
    };

    const handleBannerSelect = async (url: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                bannerUrl: url
            });
            setShowBannerPresetModal(false);
            showToast('Banner updated!', 'success');
        } catch (error) {
            console.error("Error updating banner:", error);
            showToast('Failed to update banner', 'error');
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

    return (
        <div className="max-w-3xl mx-auto animate-fade-in pb-20">
            {/* Header Card */}
            <div 
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="bg-card rounded-2xl border border-gray-800 overflow-hidden shadow-2xl mb-6 relative group"
            >
                <button 
                    onClick={() => setShowSettingsModal(true)}
                    className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black rounded-full border border-gray-700 transition text-gray-300 hover:text-white z-20 backdrop-blur-sm"
                    title="Settings"
                >
                    <SettingsIcon className="w-5 h-5" />
                </button>
                <div 
                    className="h-32 bg-gradient-to-r from-brand-900 via-purple-900 to-black relative bg-cover bg-center"
                    style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : {}}
                >
                    <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                    <button 
                        onClick={() => setShowBannerPresetModal(true)}
                        className="absolute bottom-4 right-4 p-2 bg-black/50 hover:bg-black rounded-full border border-gray-700 transition text-gray-300 hover:text-white z-20 backdrop-blur-sm"
                        title="Change Banner"
                    >
                        <ImageIcon className="w-4 h-4" />
                    </button>
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Processing Image...</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col md:flex-row items-end gap-6 -mt-12 relative z-10">
                        <div className="relative group flex flex-col items-center gap-2">
                            <div className="w-32 h-32 rounded-2xl border-4 border-card bg-dark overflow-hidden shadow-xl relative">
                                <img 
                                    src={profile.profilePicUrl || DEFAULT_AVATAR} 
                                    alt={profile.username} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                    referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-white text-center px-2">Paste or Drop<br/>to Update</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPresetModal(true)}
                                className="text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 transition bg-brand-500/10 px-3 py-1.5 rounded-full border border-brand-500/20 flex items-center gap-1"
                            >
                                <ImageIcon className="w-3 h-3" /> Choose Preset
                            </button>
                        </div>
                        <div className="flex-grow pb-2 w-full">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-3xl font-black text-white tracking-tight">{profile.username}</h2>
                                        <span className="bg-brand-500/10 text-brand-400 border border-brand-500/20 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest flex items-center gap-1">
                                            <Shield className="w-3 h-3" /> {profile.role}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs text-gray-500 font-mono bg-dark px-2 py-1 rounded border border-gray-800 flex items-center gap-2">
                                            ID: {user?.uid}
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
                                    <div className="flex flex-wrap items-center gap-4 text-gray-500 text-sm font-medium mb-3">
                                        <div className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {profile.email}</div>
                                        {profile.phone && <div className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {profile.phone}</div>}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm font-bold text-gray-400">
                                        <div><span className="text-white">{followerCount}</span> Followers</div>
                                        <div><span className="text-white">{followingCount}</span> Following</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-t border-gray-800 px-8">
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition border-t-2 ${activeTab === 'settings' ? 'text-brand-400 border-brand-500' : 'text-gray-500 border-transparent hover:text-white'}`}
                    >
                        Overview
                    </button>
                    <button 
                        onClick={() => setActiveTab('activity')}
                        className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition border-t-2 ${activeTab === 'activity' ? 'text-brand-400 border-brand-500' : 'text-gray-500 border-transparent hover:text-white'}`}
                    >
                        Activity
                    </button>
                </div>
            </div>

            {activeTab === 'settings' ? (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div onClick={() => navigate('/wallet')} className="bg-card p-6 rounded-2xl border border-gray-800 hover:border-brand-500/50 transition cursor-pointer group shadow-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20 text-green-400">
                                    <WalletIcon className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Wallet Balance</span>
                            </div>
                            <div className="text-2xl font-black text-white group-hover:text-brand-400 transition">{formatCurrency(profile.balance)}</div>
                        </div>
                        <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20 text-yellow-400">
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Total Earnings</span>
                            </div>
                            <div className="text-2xl font-black text-white">{formatCurrency(profile.totalEarnings || 0)}</div>
                        </div>
                        <div onClick={() => navigate('/teams')} className="bg-card p-6 rounded-2xl border border-gray-800 hover:border-brand-500/50 transition cursor-pointer group shadow-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-brand-500/10 rounded-lg border border-brand-500/20 text-brand-400">
                                    <Users className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Teams Dashboard</span>
                            </div>
                            <div className="text-sm font-bold text-gray-400 group-hover:text-white transition">Manage your teams</div>
                        </div>
                    </div>

                    {/* Bio & Skills */}
                    <div className="bg-card p-8 rounded-2xl border border-gray-800 shadow-2xl space-y-6">
                        <div>
                            <h3 className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3 flex items-center gap-2">
                                <Info className="w-3 h-3" /> About Me
                            </h3>
                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                {profile.bio || "No bio provided yet."}
                            </p>
                        </div>
                        
                        {profile.skills && profile.skills.length > 0 && (
                            <div className="pt-6 border-t border-gray-800">
                                <h3 className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3 flex items-center gap-2">
                                    <Briefcase className="w-3 h-3" /> Skills
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {profile.skills.map((skill, i) => (
                                        <span key={i} className="bg-dark border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-card rounded-2xl border border-gray-800 p-8 shadow-2xl">
                    <div className="flex items-center gap-2 border-b border-gray-800 pb-4 mb-6">
                        <Clock className="text-brand-500" />
                        <h3 className="font-black text-white uppercase tracking-widest">Recent Activity</h3>
                    </div>

                    {loadingActivity ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Fetching history...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentActivity.length > 0 ? (
                                recentActivity.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-dark/50 rounded-xl border border-gray-800 hover:border-gray-700 transition">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                                                item.type === 'deposit' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                                                item.type === 'withdrawal' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                                                'bg-brand-900/20 border-brand-500/30 text-brand-400'
                                            }`}>
                                                {item.type === 'deposit' ? <ArrowDown className="w-5 h-5" /> :
                                                 item.type === 'withdrawal' ? <ArrowUp className="w-5 h-5" /> :
                                                 <Trophy className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-white capitalize">{item.type}</div>
                                                <div className="text-[10px] text-gray-500">{formatDate(item.timestamp)}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-black ${item.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {item.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(item.amount))}
                                            </div>
                                            <div className="text-[10px] text-gray-600 uppercase font-bold">{item.status}</div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20">
                                    <Clock className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                                    <p className="text-gray-600 font-black uppercase tracking-widest text-sm">No recent activity found</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <Modal isOpen={showPresetModal} onClose={() => setShowPresetModal(false)} title="Choose Preset Avatar">
                <div className="p-6">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {PRESET_AVATARS.map((url, index) => (
                            <button
                                key={index}
                                onClick={async () => {
                                    if (!user) return;
                                    setShowPresetModal(false);
                                    setIsUploading(true);
                                    try {
                                        await updateDoc(doc(db, 'users', user.uid), {
                                            profilePicUrl: url
                                        });
                                        showToast('Profile picture updated!', 'success');
                                    } catch (error) {
                                        console.error("Error updating profile picture:", error);
                                        showToast('Failed to update profile picture', 'error');
                                    } finally {
                                        setIsUploading(false);
                                    }
                                }}
                                className="relative group rounded-2xl overflow-hidden border-2 border-gray-800 hover:border-brand-500 transition-all aspect-square bg-dark"
                            >
                                <img src={url} alt={`Preset ${index + 1}`} className="w-full h-full object-cover p-2" />
                                <div className="absolute inset-0 bg-brand-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-brand-400 drop-shadow-lg" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Account Settings" size="lg">
                <div className="p-6 max-h-[80vh] overflow-y-auto space-y-8">
                    {/* Edit Profile Form */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-800 pb-4">
                            <User className="text-brand-500" />
                            <h3 className="font-black text-white uppercase tracking-widest">Profile Details</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Hash className="w-3 h-3" /> In-Game ID (UID) * {isUidLocked && <span className="text-brand-500 font-normal">(Locked)</span>}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={inGameId} 
                                        onChange={(e) => setInGameId(e.target.value)}
                                        placeholder="e.g. 512345678" 
                                        readOnly={isUidLocked}
                                        className={`w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold min-h-[44px] ${isUidLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <User className="w-3 h-3" /> In-Game Name
                                    </label>
                                    <input 
                                        type="text" 
                                        value={inGameName} 
                                        onChange={(e) => setInGameName(e.target.value)}
                                        placeholder="Enter In-Game Name" 
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold min-h-[44px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Users className="w-3 h-3" /> Team Name
                                    </label>
                                    <input 
                                        type="text" 
                                        value={teamName} 
                                        onChange={(e) => setTeamName(e.target.value)}
                                        placeholder="Enter Team Name" 
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold min-h-[44px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> Phone Number
                                    </label>
                                    <input 
                                        type="tel" 
                                        value={phone} 
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="e.g. 98XXXXXXXX"
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold min-h-[44px]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Info className="w-3 h-3" /> Bio / Description
                                    </label>
                                    <textarea 
                                        value={bio} 
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Tell us about yourself..." 
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition h-[120px] resize-none text-sm leading-relaxed min-h-[44px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                        <Briefcase className="w-3 h-3" /> Skills (Comma separated)
                                    </label>
                                    <input 
                                        type="text" 
                                        value={skills} 
                                        onChange={(e) => setSkills(e.target.value)}
                                        placeholder="e.g. React, Node.js, UI/UX"
                                        className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold min-h-[44px]"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                            Status
                                        </label>
                                        <select 
                                            value={status} 
                                            onChange={(e) => setStatus(e.target.value as any)}
                                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold appearance-none min-h-[44px]"
                                        >
                                            <option value="online">🟢 Online</option>
                                            <option value="idle">🟡 Idle</option>
                                            <option value="dnd">🔴 Do Not Disturb</option>
                                            <option value="offline">⚫ Offline</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                                            Custom Activity
                                        </label>
                                        <input 
                                            type="text" 
                                            value={customActivity} 
                                            onChange={(e) => setCustomActivity(e.target.value)}
                                            placeholder="e.g. Coding..."
                                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold min-h-[44px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 text-white py-4 rounded-xl font-black transition shadow-lg uppercase tracking-widest flex items-center justify-center gap-2 min-h-[44px]"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" /> Save Profile Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    {/* Security */}
                    <div className="pt-8 border-t border-gray-800">
                        <div className="flex items-center gap-2 mb-6">
                            <Shield className="text-brand-500" />
                            <h3 className="font-black text-white uppercase tracking-widest">Security & Authentication</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs text-gray-400 mb-4">Update your account password to keep your wallet secure.</p>
                                <button 
                                    onClick={async () => {
                                        const email = profile.email;
                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Reset Password',
                                            message: `Send password reset email to ${email}?`,
                                            onConfirm: async () => {
                                                try {
                                                    await sendPasswordResetEmail(auth, email);
                                                    showToast('Password reset link sent to your email!', 'success');
                                                } catch (e: any) {
                                                    console.error(e);
                                                    showToast(e.message || 'Error sending reset link', 'error');
                                                }
                                            }
                                        });
                                    }}
                                    className="text-xs font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest flex items-center gap-2"
                                >
                                    <Mail className="w-4 h-4" /> Send Reset Link
                                </button>
                            </div>
                            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs text-gray-400 mb-4">Change your account email address.</p>
                                <div className="flex gap-2">
                                    <input 
                                        type="email" 
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        placeholder="New Email Address" 
                                        className="bg-dark border border-gray-700 rounded-xl px-3 py-2 text-white flex-grow text-xs focus:border-brand-500 outline-none transition font-bold"
                                    />
                                    <button 
                                        onClick={handleUpdateEmail} 
                                        disabled={isUpdatingEmail || !newEmail}
                                        className="bg-brand-600 px-4 rounded-xl hover:bg-brand-500 disabled:bg-gray-700 text-white text-[10px] font-black transition uppercase tracking-widest shadow-lg whitespace-nowrap"
                                    >
                                        {isUpdatingEmail ? 'Updating...' : 'Update'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Organizer Application */}
                    {profile.role === 'player' && !profile.orgStatus && (
                        <div className="pt-8 border-t border-gray-800">
                            <div className="bg-brand-500/5 p-6 rounded-2xl border border-brand-500/20">
                                <div className="flex items-center gap-3 mb-4">
                                    <Briefcase className="text-brand-400" />
                                    <h4 className="font-black text-white uppercase tracking-widest text-sm">Become an Organizer</h4>
                                </div>
                                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                                    Want to host your own tournaments and manage teams? Apply for an organizer account. Our team will review your application within 48 hours.
                                </p>
                                <div className="flex gap-3">
                                    <input 
                                        type="text" 
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        placeholder="Organization / Brand Name" 
                                        className="bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white flex-grow text-sm focus:border-brand-500 outline-none transition font-bold"
                                    />
                                    <button 
                                        onClick={handleOrgApply} 
                                        className="bg-brand-600 px-6 rounded-xl hover:bg-brand-500 text-white text-xs font-black transition uppercase tracking-widest shadow-lg"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {profile.orgStatus === 'pending' && (
                        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl text-center text-yellow-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                            <Info className="w-4 h-4" /> Application Pending Review
                        </div>
                    )}
                </div>
            </Modal>

            <Modal isOpen={showBannerPresetModal} onClose={() => setShowBannerPresetModal(false)} title="Choose Banner Preset">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
                    {PRESET_PLAYER_BANNERS.map((url, index) => (
                        <button
                            key={index}
                            onClick={() => handleBannerSelect(url)}
                            className="relative group rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-500 transition-all aspect-video"
                        >
                            <img src={url} alt={`Preset ${index + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-xs font-black uppercase tracking-widest text-white bg-brand-500 px-3 py-1 rounded-full">Select</span>
                            </div>
                        </button>
                    ))}
                </div>
            </Modal>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirmModal}
                isDestructive={confirmModal.isDestructive}
            />
        </div>
    );
};

export default Profile;
