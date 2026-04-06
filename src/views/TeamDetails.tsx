import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Team, TeamMember, UserProfile, TeamInvite, TeamActivity } from '../types';
import { Users, Shield, UserPlus, Settings, LogOut, Check, X, ArrowLeft, Crown, Activity, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { useInvisibleImage } from '../hooks/useInvisibleImage';
import { NEXPLAY_LOGO, PRESET_TEAM_LOGOS } from '../constants';
import { timeAgo } from '../utils';
import Modal from '../components/Modal';

const TeamDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    
    const [team, setTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [invites, setInvites] = useState<TeamInvite[]>([]);
    const [activities, setActivities] = useState<TeamActivity[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editLogo, setEditLogo] = useState('');
    const [editBanner, setEditBanner] = useState('');
    const [saving, setSaving] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isUploadingBanner, setIsUploadingBanner] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);

    const logoUpload = useInvisibleImage({
        folder: 'teams/logos',
        onUploadStart: () => setIsUploadingLogo(true),
        onUploadEnd: () => setIsUploadingLogo(false),
        onUploadSuccess: (url) => setEditLogo(url)
    });

    const bannerUpload = useInvisibleImage({
        folder: 'teams/banners',
        onUploadStart: () => setIsUploadingBanner(true),
        onUploadEnd: () => setIsUploadingBanner(false),
        onUploadSuccess: (url) => setEditBanner(url)
    });

    const [inviteUserId, setInviteUserId] = useState('');
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        if (id) {
            fetchTeamData();
        }
    }, [id]);

    const fetchTeamData = async () => {
        setLoading(true);
        try {
            if (!id) return;
            // Fetch team
            const teamDoc = await getDoc(doc(db, 'teams', id));
            if (teamDoc.exists()) {
                const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
                setTeam(teamData);
                setEditName(teamData.name);
                setEditDesc(teamData.description || '');
                setEditLogo(teamData.logoUrl || '');
                setEditBanner(teamData.bannerUrl || '');
            } else {
                showToast('Team not found', 'error');
                return;
            }

            // Fetch members
            const membersQ = query(collection(db, 'team_members'), where('teamId', '==', id));
            const membersSnap = await getDocs(membersQ);
            const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as TeamMember));
            
            // Fetch user profiles for members
            const userIds = [...new Set(membersData.map(m => m.userId))];
            const userProfilesMap: Record<string, UserProfile> = {};
            
            if (userIds.length > 0) {
                const chunks = [];
                for (let i = 0; i < userIds.length; i += 10) {
                    chunks.push(userIds.slice(i, i + 10));
                }
                
                for (const chunk of chunks) {
                    const q = query(collection(db, 'users_public'), where('__name__', 'in', chunk));
                    const usersSnap = await getDocs(q);
                    usersSnap.docs.forEach(doc => {
                        userProfilesMap[doc.id] = { uid: doc.id, ...doc.data() } as UserProfile;
                    });
                }
            }

            const membersWithProfiles = membersData.map(m => {
                if (userProfilesMap[m.userId]) {
                    return { ...m, user: userProfilesMap[m.userId] };
                }
                return m;
            });
            setMembers(membersWithProfiles);

            // Fetch pending invites
            const invitesQ = query(collection(db, 'team_invites'), where('teamId', '==', id), where('status', '==', 'pending'));
            const invitesSnap = await getDocs(invitesQ);
            setInvites(invitesSnap.docs.map(d => ({ id: d.id, ...d.data() } as TeamInvite)));

            // Fetch activities
            const activitiesQ = query(collection(db, 'team_activity'), where('teamId', '==', id));
            const activitiesSnap = await getDocs(activitiesQ);
            const acts = activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as TeamActivity));
            acts.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
            setActivities(acts);

        } catch (error) {
            console.error("Error fetching team:", error);
        } finally {
            setLoading(false);
        }
    };

    const logActivity = async (action: string, details?: string) => {
        if (!team || !user) return;
        try {
            await addDoc(collection(db, 'team_activity'), {
                teamId: team.id,
                userId: user.uid,
                userName: user.username,
                action,
                details,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Failed to log activity", e);
        }
    };

    const handleSaveTeam = async () => {
        if (!team || !editName.trim()) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'teams', team.id), {
                name: editName,
                description: editDesc,
                logoUrl: editLogo,
                bannerUrl: editBanner
            });
            await logActivity('updated_team', 'Updated team profile settings');
            showToast('Team updated successfully', 'success');
            setIsEditing(false);
            fetchTeamData();
        } catch (error) {
            console.error("Error updating team:", error);
            showToast('Failed to update team', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleInvite = async () => {
        if (!team || !user || !inviteUserId.trim()) return;
        
        if (members.length >= 6) {
            showToast('Team is full (max 6 players)', 'error');
            return;
        }

        setInviting(true);
        try {
            // Check if user exists
            const userDoc = await getDoc(doc(db, 'users_public', inviteUserId));
            if (!userDoc.exists()) {
                showToast('User not found', 'error');
                setInviting(false);
                return;
            }

            // Check if already a member
            if (members.some(m => m.userId === inviteUserId)) {
                showToast('User is already a member', 'warning');
                setInviting(false);
                return;
            }

            // Check if already invited
            if (invites.some(i => i.inviteeId === inviteUserId)) {
                showToast('User already has a pending invite', 'warning');
                setInviting(false);
                return;
            }

            await addDoc(collection(db, 'team_invites'), {
                teamId: team.id,
                teamName: team.name,
                inviterId: user.uid,
                inviteeId: inviteUserId,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            // Also create a notification for the user
            await addDoc(collection(db, 'notifications'), {
                userId: inviteUserId,
                title: 'Team Invitation',
                message: `You have been invited to join ${team.name}`,
                type: 'invite',
                read: false,
                link: `/team/${team.id}`,
                timestamp: serverTimestamp()
            });

            await logActivity('invited_user', `Invited user ${userDoc.data().username}`);

            showToast('Invitation sent!', 'success');
            setInviteUserId('');
            fetchTeamData();
        } catch (error) {
            console.error("Error sending invite:", error);
            showToast('Failed to send invite', 'error');
        } finally {
            setInviting(false);
        }
    };

    const handleAcceptInvite = async (inviteId: string) => {
        if (!team || !user) return;

        if (members.length >= 6) {
            showToast('Team is full (max 6 players)', 'error');
            return;
        }

        if (profile?.teamId && profile.teamId !== team.id) {
            showToast('You are already in a team. Leave your current team first.', 'error');
            return;
        }

        try {
            await updateDoc(doc(db, 'team_invites', inviteId), { status: 'accepted' });
            await addDoc(collection(db, 'team_members'), {
                teamId: team.id,
                userId: user.uid,
                role: 'member',
                joinedAt: serverTimestamp()
            });

            // Auto-fill team name and ID in profile
            await updateDoc(doc(db, 'users', user.uid), { 
                teamName: team.name,
                teamId: team.id 
            });
            await updateDoc(doc(db, 'users_public', user.uid), { 
                teamName: team.name,
                teamId: team.id 
            });

            await logActivity('joined_team', 'Joined the team via invitation');
            showToast('Joined team successfully!', 'success');
            fetchTeamData();
        } catch (error) {
            console.error("Error accepting invite:", error);
            showToast('Failed to join team', 'error');
        }
    };

    const handleDeclineInvite = async (inviteId: string) => {
        try {
            await updateDoc(doc(db, 'team_invites', inviteId), { status: 'declined' });
            showToast('Invitation declined', 'info');
            fetchTeamData();
        } catch (error) {
            console.error("Error declining invite:", error);
        }
    };

    const handleLeaveTeam = async () => {
        if (!team || !user || !currentUserMember) return;
        if (!window.confirm('Are you sure you want to leave this team?')) return;
        
        try {
            await deleteDoc(doc(db, 'team_members', currentUserMember.id));
            
            // Clear team name and ID in profile if it matches this team
            if (profile?.teamName === team.name) {
                await updateDoc(doc(db, 'users', user.uid), { 
                    teamName: '',
                    teamId: '' 
                });
                await updateDoc(doc(db, 'users_public', user.uid), { 
                    teamName: '',
                    teamId: '' 
                });
            }
            
            await logActivity('left_team', 'Left the team');
            showToast('You have left the team', 'info');
            fetchTeamData();
        } catch (error) {
            console.error("Error leaving team:", error);
            showToast('Failed to leave team', 'error');
        }
    };

    const handleRemoveMember = async (memberId: string, memberName: string, memberUserId: string) => {
        if (!window.confirm(`Are you sure you want to remove ${memberName}?`)) return;
        try {
            await deleteDoc(doc(db, 'team_members', memberId));
            
            // Clear team name and ID in the removed user's profile
            await updateDoc(doc(db, 'users', memberUserId), { 
                teamName: '',
                teamId: '' 
            });
            await updateDoc(doc(db, 'users_public', memberUserId), { 
                teamName: '',
                teamId: '' 
            });

            await logActivity('removed_member', `Removed ${memberName} from the team`);
            showToast('Member removed', 'success');
            fetchTeamData();
        } catch (error) {
            console.error("Error removing member:", error);
            showToast('Failed to remove member', 'error');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Team...</p>
            </div>
        );
    }

    if (!team) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Team Not Found</h2>
                <Link to="/teams" className="text-brand-500 hover:text-brand-400 font-bold flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Teams
                </Link>
            </div>
        );
    }

    const isOwner = user?.uid === team.ownerId;
    const currentUserMember = members.find(m => m.userId === user?.uid);
    const isAdmin = isOwner || currentUserMember?.role === 'admin';
    const isMember = !!currentUserMember;
    const pendingInvite = invites.find(i => i.inviteeId === user?.uid);

    return (
        <div className="max-w-5xl mx-auto animate-fade-in pb-20">
            <Link to="/teams" className="inline-flex items-center gap-2 text-gray-400 hover:text-white font-bold text-sm uppercase tracking-wider mb-6 transition">
                <ArrowLeft className="w-4 h-4" /> Back to Teams
            </Link>

            {/* Header Card */}
            <div className="bg-card rounded-2xl border border-gray-800 overflow-hidden shadow-2xl mb-8 relative">
                <div className="h-48 bg-gradient-to-r from-brand-900 via-purple-900 to-black relative">
                    {team.bannerUrl && (
                        <img src={team.bannerUrl || undefined} alt="Banner" className="w-full h-full object-cover opacity-50" />
                    )}
                    <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                </div>
                
                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col md:flex-row items-end gap-6 -mt-16 relative z-10">
                        <div className="w-32 h-32 rounded-2xl border-4 border-card bg-dark overflow-hidden shadow-xl flex items-center justify-center bg-gradient-to-br from-brand-600 to-purple-800 text-4xl font-black text-white shrink-0">
                            {team.logoUrl ? (
                                <img src={team.logoUrl || undefined} className="w-full h-full object-cover" alt="Logo" />
                            ) : (
                                <Users className="w-12 h-12 text-white/50" />
                            )}
                        </div>
                        <div className="flex-grow pb-2 w-full">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-4xl font-black text-white tracking-tight mb-1">{team.name}</h1>
                                    <p className="text-gray-400 font-medium max-w-2xl">{team.description || 'No description provided.'}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {isAdmin && !isEditing && (
                                        <button 
                                            onClick={() => setIsEditing(true)}
                                            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-xs transition flex items-center gap-2"
                                        >
                                            <Settings className="w-4 h-4" /> Edit Team
                                        </button>
                                    )}
                                    {isMember && !isOwner && (
                                        <button 
                                            onClick={handleLeaveTeam}
                                            className="bg-red-600/20 hover:bg-red-600/30 text-red-500 px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-xs transition flex items-center gap-2 border border-red-500/20"
                                        >
                                            <LogOut className="w-4 h-4" /> Leave Team
                                        </button>
                                    )}
                                    {pendingInvite && (
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleAcceptInvite(pendingInvite.id)}
                                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-xs transition flex items-center gap-2"
                                            >
                                                <Check className="w-4 h-4" /> Accept
                                            </button>
                                            <button 
                                                onClick={() => handleDeclineInvite(pendingInvite.id)}
                                                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-xs transition flex items-center gap-2"
                                            >
                                                <X className="w-4 h-4" /> Decline
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isEditing && isAdmin && (
                <div className="bg-card p-6 rounded-2xl border border-brand-500/50 shadow-2xl mb-8 animate-fade-in relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-purple-500"></div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest mb-6">Edit Team Profile</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Team Name</label>
                                <input 
                                    type="text" 
                                    value={editName} 
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Description</label>
                                <textarea 
                                    value={editDesc} 
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition h-32 resize-none text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Team Logo</label>
                                <div className="flex flex-col items-start gap-2">
                                    <div 
                                        onPaste={logoUpload.handlePaste}
                                        onDrop={logoUpload.handleDrop}
                                        onDragOver={logoUpload.handleDragOver}
                                        className="w-24 h-24 rounded-xl bg-dark border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden relative group cursor-pointer hover:border-brand-500 transition"
                                    >
                                        {editLogo ? (
                                            <img src={editLogo} alt="Logo" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)} />
                                        ) : (
                                            <Users className="w-8 h-8 text-gray-600" />
                                        )}
                                        {isUploadingLogo && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-white text-center px-1">Paste/Drop</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowPresetModal(true)}
                                        className="text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 transition bg-brand-500/10 px-3 py-1.5 rounded-full border border-brand-500/20 flex items-center gap-1"
                                    >
                                        <ImageIcon className="w-3 h-3" /> Choose Preset
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Team Banner</label>
                                <div 
                                    onPaste={bannerUpload.handlePaste}
                                    onDrop={bannerUpload.handleDrop}
                                    onDragOver={bannerUpload.handleDragOver}
                                    className="w-full h-24 rounded-xl bg-dark border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden relative group cursor-pointer hover:border-brand-500 transition"
                                >
                                    {editBanner ? (
                                        <img src={editBanner} alt="Banner" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)} />
                                    ) : (
                                        <Activity className="w-8 h-8 text-gray-600" />
                                    )}
                                    {isUploadingBanner && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-white text-center px-1">Paste or Drop Banner</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-800">
                        <button 
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveTeam}
                            disabled={saving || !editName.trim()}
                            className="bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest transition shadow-lg"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Members List */}
                    <div className="bg-card rounded-2xl border border-gray-800 p-6 shadow-lg backdrop-blur-md bg-white/5">
                        <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Users className="text-brand-500 w-5 h-5" /> Members ({members.length})
                            </h3>
                        </div>
                        
                        <div className="space-y-3">
                            {members.map(member => (
                                <div key={member.id} className="flex items-center justify-between bg-dark p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition group">
                                    <div className="flex items-center gap-4">
                                        <Link to={`/user/${member.userId}`} className="w-12 h-12 rounded-full bg-gray-800 overflow-hidden border-2 border-gray-700 group-hover:border-brand-500 transition shrink-0">
                                            {member.user?.profilePicUrl ? (
                                                <img src={member.user.profilePicUrl || undefined} alt={member.user.username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500 font-black text-lg">
                                                    {member.user?.username?.[0]?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                        </Link>
                                        <div>
                                            <Link to={`/user/${member.userId}`} className="font-black text-white hover:text-brand-400 transition text-lg">
                                                {member.user?.username || 'Unknown User'}
                                            </Link>
                                            <div className="flex items-center gap-2 mt-1">
                                                {member.userId === team.ownerId ? (
                                                    <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1">
                                                        <Crown className="w-3 h-3" /> Owner
                                                    </span>
                                                ) : member.role === 'admin' ? (
                                                    <span className="text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1">
                                                        <Shield className="w-3 h-3" /> Admin
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                                                        Member
                                                    </span>
                                                )}
                                                {member.user?.customActivity && (
                                                    <span className="text-[10px] text-gray-500 italic">
                                                        {member.user.customActivity}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {isAdmin && member.userId !== team.ownerId && (
                                        <button 
                                            onClick={() => handleRemoveMember(member.id, member.user?.username || 'Unknown User', member.userId)}
                                            className="text-gray-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                                            title="Remove Member"
                                        >
                                            <LogOut className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Activity Feed */}
                    <div className="bg-card rounded-2xl border border-gray-800 p-6 shadow-lg backdrop-blur-md bg-white/5 mt-8">
                        <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Activity className="text-brand-500 w-5 h-5" /> Activity Feed
                            </h3>
                        </div>
                        
                        <div className="space-y-4">
                            {activities.length > 0 ? (
                                activities.map(act => (
                                    <div key={act.id} className="flex gap-4 items-start bg-dark p-4 rounded-xl border border-gray-800">
                                        <div className="w-8 h-8 rounded-full bg-brand-900/50 flex items-center justify-center shrink-0 border border-brand-500/30">
                                            <Activity className="w-4 h-4 text-brand-400" />
                                        </div>
                                        <div className="flex-grow">
                                            <p className="text-sm text-gray-300">
                                                <span className="font-bold text-white">{act.userName}</span> {act.details || act.action}
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
                                                {act.createdAt ? timeAgo(act.createdAt.toDate()) : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-500 font-bold uppercase tracking-widest text-xs">
                                    No recent activity
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Invite Section */}
                    {isAdmin && (
                        <div className="bg-card rounded-2xl border border-gray-800 p-6 shadow-lg backdrop-blur-md bg-white/5">
                            <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                <UserPlus className="text-brand-500 w-5 h-5" /> Invite Members
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">User ID to Invite</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={inviteUserId}
                                            onChange={(e) => setInviteUserId(e.target.value)}
                                            placeholder="Paste User ID here..."
                                            className="flex-grow bg-dark border border-gray-700 rounded-xl px-4 py-2 text-white focus:border-brand-500 outline-none transition text-sm font-mono"
                                        />
                                        <button 
                                            onClick={handleInvite}
                                            disabled={inviting || !inviteUserId.trim()}
                                            className="bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-xl font-bold transition shrink-0"
                                        >
                                            {inviting ? '...' : 'Invite'}
                                        </button>
                                    </div>
                                </div>
                                
                                {invites.length > 0 && (
                                    <div className="mt-6 pt-4 border-t border-gray-800">
                                        <h4 className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Pending Invites</h4>
                                        <div className="space-y-2">
                                            {invites.map(invite => (
                                                <div key={invite.id} className="flex items-center justify-between bg-dark p-3 rounded-lg border border-gray-800">
                                                    <span className="text-xs text-gray-400 font-mono truncate max-w-[150px]">{invite.inviteeId}</span>
                                                    <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded uppercase font-bold">Pending</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={showPresetModal} onClose={() => setShowPresetModal(false)} title="Choose Preset Team Logo">
                <div className="p-6">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {PRESET_TEAM_LOGOS.map((url, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setEditLogo(url);
                                    setShowPresetModal(false);
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
        </div>
    );
};

export default TeamDetails;
