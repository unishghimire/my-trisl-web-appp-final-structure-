import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, where, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Team, TeamMember } from '../types';
import { Users, Plus, Search, Shield, ArrowRight, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useInvisibleImage } from '../hooks/useInvisibleImage';
import { DEFAULT_TEAM_LOGO, NEXPLAY_LOGO, PRESET_TEAM_LOGOS } from '../constants';
import Modal from '../components/Modal';

const Teams: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();
    
    const [teams, setTeams] = useState<Team[]>([]);
    const [myTeams, setMyTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isCreating, setIsCreating] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDesc, setNewTeamDesc] = useState('');
    const [newTeamLogo, setNewTeamLogo] = useState('');
    const [creating, setCreating] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);

    const { handlePaste, handleDrop, handleDragOver } = useInvisibleImage({
        onUploadStart: () => setIsUploadingLogo(true),
        onUploadEnd: () => setIsUploadingLogo(false),
        onUploadSuccess: (url) => setNewTeamLogo(url),
        onError: (err) => showToast(err, 'error')
    });

    useEffect(() => {
        fetchTeams();
    }, [user]);

    const fetchTeams = async () => {
        setLoading(true);
        try {
            // Fetch all teams
            const q = query(collection(db, 'teams'));
            const snap = await getDocs(q);
            const allTeams = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
            setTeams(allTeams);

            if (user) {
                // Fetch my teams
                const memberQ = query(collection(db, 'team_members'), where('userId', '==', user.uid));
                const memberSnap = await getDocs(memberQ);
                const myTeamIds = memberSnap.docs.map(d => d.data().teamId);
                
                setMyTeams(allTeams.filter(t => myTeamIds.includes(t.id) || t.ownerId === user.uid));
            }
        } catch (error) {
            console.error("Error fetching teams:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTeam = async () => {
        if (!user || !newTeamName.trim()) return;

        if (myTeams.length >= 1) {
            showToast('You can only be in one team at a time.', 'error');
            return;
        }

        setCreating(true);
        try {
            const teamData = {
                name: newTeamName,
                description: newTeamDesc,
                logoUrl: newTeamLogo,
                ownerId: user.uid,
                createdAt: serverTimestamp()
            };
            const docRef = await addDoc(collection(db, 'teams'), teamData);
            
            // Add creator as admin
            await addDoc(collection(db, 'team_members'), {
                teamId: docRef.id,
                userId: user.uid,
                role: 'admin',
                joinedAt: serverTimestamp()
            });

            // Auto-fill team name and ID in profile
            await updateDoc(doc(db, 'users', user.uid), { 
                teamName: newTeamName,
                teamId: docRef.id 
            });
            await updateDoc(doc(db, 'users_public', user.uid), { 
                teamName: newTeamName,
                teamId: docRef.id 
            });

            showToast('Team created successfully!', 'success');
            setIsCreating(false);
            setNewTeamName('');
            setNewTeamDesc('');
            setNewTeamLogo('');
            fetchTeams();
            navigate(`/team/${docRef.id}`);
        } catch (error) {
            console.error("Error creating team:", error);
            showToast('Failed to create team', 'error');
        } finally {
            setCreating(false);
        }
    };

    const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <Users className="text-brand-500 w-8 h-8" /> Teams
                    </h1>
                    <p className="text-gray-400 mt-1">Discover and join teams, or create your own.</p>
                </div>
                {user && (
                    <button 
                        onClick={() => {
                            if (myTeams.length >= 1) {
                                showToast('You can only be in one team at a time.', 'error');
                                return;
                            }
                            setIsCreating(true);
                        }}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest transition flex items-center gap-2 shadow-lg shadow-brand-500/20"
                    >
                        <Plus className="w-5 h-5" /> Create Team
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-2xl mb-8 animate-fade-in">
                    <h3 className="text-xl font-black text-white uppercase tracking-widest mb-4">Create New Team</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Team Name *</label>
                                <input 
                                    type="text" 
                                    value={newTeamName} 
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold"
                                    placeholder="e.g. Cloud9"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Description</label>
                                <textarea 
                                    value={newTeamDesc} 
                                    onChange={(e) => setNewTeamDesc(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition h-24 resize-none text-sm"
                                    placeholder="What is your team about?"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Team Logo (Paste or Drop Image)</label>
                            <div className="flex flex-col items-start gap-3">
                                <div 
                                    onPaste={handlePaste}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    className={`relative w-32 h-32 rounded-2xl border-2 border-dashed transition-all flex flex-center justify-center overflow-hidden group cursor-pointer ${isUploadingLogo ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                                >
                                    {isUploadingLogo ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <img 
                                                src={newTeamLogo || DEFAULT_TEAM_LOGO} 
                                                alt="Team Logo Preview" 
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                                onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                referrerPolicy="no-referrer"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                                <Plus className="w-8 h-8 text-white" />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowPresetModal(true)}
                                    className="text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 transition bg-brand-500/10 px-3 py-1.5 rounded-full border border-brand-500/20 flex items-center gap-1"
                                >
                                    <ImageIcon className="w-3 h-3" /> Choose Preset
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button 
                            onClick={() => setIsCreating(false)}
                            className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleCreateTeam}
                            disabled={creating || !newTeamName.trim()}
                            className="bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest transition shadow-lg flex items-center gap-2"
                        >
                            {creating ? 'Creating...' : 'Create Team'}
                        </button>
                    </div>
                </div>
            )}

            <Modal isOpen={showPresetModal} onClose={() => setShowPresetModal(false)} title="Choose Preset Team Logo">
                <div className="p-6">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {PRESET_TEAM_LOGOS.map((url, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setNewTeamLogo(url);
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

            {user && myTeams.length > 0 && (
                <div className="mb-12">
                    <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 border-b border-gray-800 pb-2">My Teams</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {myTeams.map(team => (
                            <Link to={`/team/${team.id}`} key={team.id} className="bg-card rounded-2xl border border-gray-800 p-6 hover:border-brand-500/50 transition group shadow-lg backdrop-blur-md bg-white/5">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-xl bg-dark border border-gray-700 overflow-hidden flex items-center justify-center">
                                        <img 
                                            src={team.logoUrl || DEFAULT_TEAM_LOGO} 
                                            alt={team.name} 
                                            className="w-full h-full object-cover" 
                                            referrerPolicy="no-referrer"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white group-hover:text-brand-400 transition">{team.name}</h3>
                                        {team.ownerId === user.uid && (
                                            <span className="text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Owner</span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 line-clamp-2">{team.description || 'No description provided.'}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <div className="flex justify-between items-end border-b border-gray-800 pb-2 mb-6">
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">All Teams</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search teams..."
                            className="bg-dark border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-brand-500 outline-none w-64"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredTeams.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-2xl border border-gray-800">
                        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">No teams found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTeams.map(team => (
                            <Link to={`/team/${team.id}`} key={team.id} className="bg-card rounded-2xl border border-gray-800 p-6 hover:border-brand-500/50 transition group shadow-lg backdrop-blur-md bg-white/5 flex flex-col h-full">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-xl bg-dark border border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                                        <img 
                                            src={team.logoUrl || DEFAULT_TEAM_LOGO} 
                                            alt={team.name} 
                                            className="w-full h-full object-cover" 
                                            referrerPolicy="no-referrer"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white group-hover:text-brand-400 transition line-clamp-1">{team.name}</h3>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex-grow">{team.description || 'No description provided.'}</p>
                                <div className="flex items-center text-brand-400 text-sm font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform mt-auto">
                                    View Team <ArrowRight className="w-4 h-4 ml-1" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Teams;
