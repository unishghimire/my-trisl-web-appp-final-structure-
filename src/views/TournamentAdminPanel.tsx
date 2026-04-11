import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Tournament, TournamentGroup, Match, Team } from '../types';
import { 
    Settings, Users, Calendar, Trophy, ArrowLeft, 
    Plus, Trash2, Edit2, CheckCircle2, AlertCircle,
    Lock, Unlock, Link as LinkIcon, QrCode, Play, Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../components/Modal';

export default function TournamentAdminPanel() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useNotification();
    
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'matches' | 'brackets' | 'settings'>('overview');

    // Group State
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [newGroup, setNewGroup] = useState({ name: '', teamLimit: 16, isPublic: true, passCode: '' });
    
    // Manage Teams State
    const [isManageTeamsModalOpen, setIsManageTeamsModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<TournamentGroup | null>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [fetchingParticipants, setFetchingParticipants] = useState(false);

    useEffect(() => {
        const fetchTournament = async () => {
            if (!id || !user) return;
            try {
                const docRef = doc(db, 'tournaments', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as Tournament;
                    if (data.hostUid !== user.uid) {
                        showToast('Unauthorized access', 'error');
                        navigate('/');
                        return;
                    }
                    setTournament(data);
                    
                    // Fetch participants
                    setFetchingParticipants(true);
                    const q = query(collection(db, 'participants'), where('tournamentId', '==', id));
                    const partSnap = await getDocs(q);
                    setParticipants(partSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                } else {
                    showToast('Tournament not found', 'error');
                    navigate('/');
                }
            } catch (error) {
                console.error("Error fetching tournament:", error);
                showToast('Failed to load tournament', 'error');
            } finally {
                setLoading(false);
                setFetchingParticipants(false);
            }
        };
        fetchTournament();
    }, [id, user, navigate, showToast]);

    const handleCreateGroup = async () => {
        if (!tournament || !newGroup.name.trim()) return;
        try {
            const group: any = {
                id: `group-${Date.now()}`,
                name: newGroup.name,
                teamLimit: newGroup.teamLimit,
                teams: [],
                matches: [],
                isPublic: newGroup.isPublic,
            };
            if (newGroup.passCode) {
                group.passCode = newGroup.passCode;
            }
            
            const updatedGroups = [...(tournament.groups || []), group as TournamentGroup];
            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });
            
            setTournament({ ...tournament, groups: updatedGroups });
            setIsCreateGroupModalOpen(false);
            setNewGroup({ name: '', teamLimit: 16, isPublic: true, passCode: '' });
            showToast('Group created successfully', 'success');
        } catch (error) {
            console.error("Error creating group:", error);
            showToast('Failed to create group', 'error');
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!tournament) return;
        if (!window.confirm('Are you sure you want to delete this group?')) return;
        try {
            const updatedGroups = (tournament.groups || []).filter(g => g.id !== groupId);
            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });
            setTournament({ ...tournament, groups: updatedGroups });
            showToast('Group deleted', 'success');
        } catch (error) {
            console.error("Error deleting group:", error);
            showToast('Failed to delete group', 'error');
        }
    };

    const handleAssignTeam = async (participantId: string) => {
        if (!tournament || !selectedGroup) return;
        
        if (selectedGroup.teams.length >= selectedGroup.teamLimit) {
            showToast('Group is full', 'error');
            return;
        }

        const participant = participants.find(p => p.id === participantId);
        if (!participant) return;

        const team: Team = {
            id: participant.teamId || participant.userId,
            name: participant.teamName || participant.username,
            players: participant.teammates ? [participant.username, ...participant.teammates] : [participant.username]
        };
        
        if (participant.logoUrl) {
            team.logoUrl = participant.logoUrl;
        }

        try {
            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === selectedGroup.id) {
                    return { ...g, teams: [...g.teams, team] };
                }
                return g;
            }) || [];

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });

            setTournament({ ...tournament, groups: updatedGroups });
            setSelectedGroup({ ...selectedGroup, teams: [...selectedGroup.teams, team] });
            showToast('Team assigned to group', 'success');
        } catch (error) {
            console.error("Error assigning team:", error);
            showToast('Failed to assign team', 'error');
        }
    };

    const handleRemoveTeam = async (teamId: string) => {
        if (!tournament || !selectedGroup) return;

        try {
            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === selectedGroup.id) {
                    return { ...g, teams: g.teams.filter(t => t.id !== teamId) };
                }
                return g;
            }) || [];

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });

            setTournament({ ...tournament, groups: updatedGroups });
            setSelectedGroup({ ...selectedGroup, teams: selectedGroup.teams.filter(t => t.id !== teamId) });
            showToast('Team removed from group', 'success');
        } catch (error) {
            console.error("Error removing team:", error);
            showToast('Failed to remove team', 'error');
        }
    };

    // Match Update State
    const [isUpdateScoreModalOpen, setIsUpdateScoreModalOpen] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<{ groupId: string, match: Match } | null>(null);
    const [matchScore, setMatchScore] = useState({ score1: 0, score2: 0, status: 'scheduled' as 'scheduled' | 'live' | 'completed' });

    const handleUpdateScore = async () => {
        if (!tournament || !selectedMatch) return;

        try {
            if (selectedMatch.groupId === 'bracket') {
                const updatedBracketMatches = tournament.bracketMatches?.map(m => {
                    if (m.id === selectedMatch.match.id) {
                        return {
                            ...m,
                            score1: matchScore.score1,
                            score2: matchScore.score2,
                            status: matchScore.status
                        };
                    }
                    return m;
                }) || [];

                await updateDoc(doc(db, 'tournaments', tournament.id), {
                    bracketMatches: updatedBracketMatches
                });

                setTournament({ ...tournament, bracketMatches: updatedBracketMatches });
            } else {
                const updatedGroups = tournament.groups?.map(g => {
                    if (g.id === selectedMatch.groupId) {
                        return {
                            ...g,
                            matches: g.matches.map(m => {
                                if (m.id === selectedMatch.match.id) {
                                    return {
                                        ...m,
                                        score1: matchScore.score1,
                                        score2: matchScore.score2,
                                        status: matchScore.status
                                    };
                                }
                                return m;
                            })
                        };
                    }
                    return g;
                }) || [];

                await updateDoc(doc(db, 'tournaments', tournament.id), {
                    groups: updatedGroups
                });

                setTournament({ ...tournament, groups: updatedGroups });
            }
            
            setIsUpdateScoreModalOpen(false);
            showToast('Score updated successfully', 'success');
        } catch (error) {
            console.error("Error updating score:", error);
            showToast('Failed to update score', 'error');
        }
    };
    const handleGenerateBracket = async () => {
        if (!tournament) return;
        
        // Collect all teams from all groups
        const allTeams: Team[] = [];
        tournament.groups?.forEach(g => {
            // In a real app, we would sort by points/wins and take top N
            // For now, take all teams that have played matches
            allTeams.push(...g.teams);
        });

        if (allTeams.length < 2) {
            showToast('Need at least 2 teams to generate bracket', 'error');
            return;
        }

        // Determine bracket size (next power of 2)
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(allTeams.length)));
        
        try {
            const bracketMatches: Match[] = [];
            let matchIdCounter = 1;
            
            // Generate first round
            for (let i = 0; i < bracketSize / 2; i++) {
                const team1 = allTeams[i * 2];
                const team2 = allTeams[i * 2 + 1];
                
                bracketMatches.push({
                    id: `bracket-${Date.now()}-${matchIdCounter++}`,
                    team1Id: team1?.id || 'TBD',
                    team2Id: team2?.id || 'TBD',
                    status: 'scheduled',
                    score1: 0,
                    score2: 0,
                    round: 1
                });
            }

            // Generate subsequent rounds (empty matches)
            let currentRoundMatches = bracketSize / 2;
            let round = 2;
            while (currentRoundMatches > 1) {
                currentRoundMatches /= 2;
                for (let i = 0; i < currentRoundMatches; i++) {
                    bracketMatches.push({
                        id: `bracket-${Date.now()}-${matchIdCounter++}`,
                        team1Id: 'TBD',
                        team2Id: 'TBD',
                        status: 'scheduled',
                        score1: 0,
                        score2: 0,
                        round: round
                    });
                }
                round++;
            }

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                bracketMatches,
                stage: 'knockout'
            });

            setTournament({ ...tournament, bracketMatches, stage: 'knockout' });
            showToast('Knockout bracket generated', 'success');
        } catch (error) {
            console.error("Error generating bracket:", error);
            showToast('Failed to generate bracket', 'error');
        }
    };
    const handleGenerateGroupMatches = async (groupId: string) => {
        if (!tournament) return;
        const group = tournament.groups?.find(g => g.id === groupId);
        if (!group || group.teams.length < 2) {
            showToast('Need at least 2 teams to generate matches', 'error');
            return;
        }

        try {
            const matches: Match[] = [];
            let matchIdCounter = 1;

            // Simple Round Robin generation
            for (let i = 0; i < group.teams.length; i++) {
                for (let j = i + 1; j < group.teams.length; j++) {
                    matches.push({
                        id: `match-${Date.now()}-${matchIdCounter++}`,
                        team1Id: group.teams[i].id,
                        team2Id: group.teams[j].id,
                        status: 'scheduled',
                        score1: 0,
                        score2: 0,
                        round: 1 // Simplified for now
                    });
                }
            }

            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === groupId) {
                    return { ...g, matches };
                }
                return g;
            }) || [];

            await updateDoc(doc(db, 'tournaments', tournament.id), {
                groups: updatedGroups
            });

            setTournament({ ...tournament, groups: updatedGroups });
            showToast('Matches generated successfully', 'success');
        } catch (error) {
            console.error("Error generating matches:", error);
            showToast('Failed to generate matches', 'error');
        }
    };

    // Group participants by team for display
    const groupedParticipants = participants.reduce((acc: any, p) => {
        const teamKey = p.teamId || p.userId;
        if (!acc[teamKey]) {
            acc[teamKey] = {
                id: teamKey,
                name: p.teamName || p.username,
                logoUrl: p.logoUrl,
                players: p.teammates ? [p.username, ...p.teammates] : [p.username],
                participantId: p.id
            };
        }
        return acc;
    }, {});
    
    const availableTeams = Object.values(groupedParticipants).filter((team: any) => {
        // Check if team is already in ANY group
        return !tournament?.groups?.some(g => g.teams.some(t => t.id === team.id));
    });

    if (loading) {
        return (
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!tournament) return null;

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(`/details/${tournament.id}`)}
                        className="p-2 bg-dark border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:border-brand-500 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-widest text-white flex items-center gap-3">
                            <Settings className="w-6 h-6 text-brand-500" />
                            Admin Panel
                        </h1>
                        <p className="text-sm text-gray-400 font-medium mt-1">{tournament.title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                        tournament.status === 'live' ? 'bg-green-500/20 text-green-500 border border-green-500/30' :
                        tournament.status === 'completed' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                        'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                    }`}>
                        {tournament.status}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-brand-500/20 text-brand-500 border border-brand-500/30">
                        {tournament.stage || 'registration'}
                    </span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto custom-scrollbar gap-2 mb-8 pb-2">
                {[
                    { id: 'overview', label: 'Overview', icon: Settings },
                    { id: 'groups', label: 'Groups & Teams', icon: Users },
                    { id: 'matches', label: 'Match Schedule', icon: Calendar },
                    { id: 'brackets', label: 'Brackets', icon: Trophy },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                            activeTab === tab.id 
                                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                                : 'bg-dark border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-dark rounded-2xl border border-gray-800 p-6">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-black uppercase tracking-widest text-white border-b border-gray-800 pb-4">Tournament Controls</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-surface p-4 rounded-xl border border-gray-800">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Status Control</h3>
                                <div className="flex gap-2">
                                    <button className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                        <Play className="w-4 h-4" /> Start
                                    </button>
                                    <button className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                        <Pause className="w-4 h-4" /> Pause
                                    </button>
                                </div>
                            </div>
                            <div className="bg-surface p-4 rounded-xl border border-gray-800">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Stage Progression</h3>
                                <select className="w-full bg-dark border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:border-brand-500 outline-none">
                                    <option value="registration">Registration</option>
                                    <option value="group_stage">Group Stage</option>
                                    <option value="knockout">Knockout Stage</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                            <div className="bg-surface p-4 rounded-xl border border-gray-800">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
                                <button className="w-full bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 border border-brand-500/20 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all">
                                    Generate Matches
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'groups' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                            <h2 className="text-lg font-black uppercase tracking-widest text-white">Groups Management</h2>
                            <button 
                                onClick={() => setIsCreateGroupModalOpen(true)}
                                className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                            >
                                <Plus className="w-4 h-4" /> Create Group
                            </button>
                        </div>
                        
                        {tournament.groups && tournament.groups.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {tournament.groups.map(group => (
                                    <div key={group.id} className="bg-surface border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-black text-white">{group.name}</h3>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                    <Users className="w-3 h-3" /> {group.teams.length} / {group.teamLimit} Teams
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteGroup(group.id)}
                                                className="text-gray-500 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs bg-dark p-2 rounded-lg border border-gray-800">
                                                <span className="text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Access</span>
                                                <span className={group.isPublic ? 'text-green-500' : 'text-yellow-500'}>
                                                    {group.isPublic ? 'Public' : 'Private'}
                                                </span>
                                            </div>
                                            {group.passCode && (
                                                <div className="flex items-center justify-between text-xs bg-dark p-2 rounded-lg border border-gray-800">
                                                    <span className="text-gray-400 flex items-center gap-1"><QrCode className="w-3 h-3" /> Passcode</span>
                                                    <span className="text-white font-mono">{group.passCode}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2">
                                            <button 
                                                onClick={() => {
                                                    setSelectedGroup(group);
                                                    setIsManageTeamsModalOpen(true);
                                                }}
                                                className="flex-1 bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                            >
                                                Manage Teams
                                            </button>
                                            <button 
                                                onClick={() => handleGenerateGroupMatches(group.id)}
                                                disabled={group.teams.length < 2 || group.matches.length > 0}
                                                className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                            >
                                                {group.matches.length > 0 ? 'Matches Generated' : 'Generate Matches'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400 font-medium">No groups created yet.</p>
                                <p className="text-sm text-gray-500 mt-2">Create groups to organize teams for the group stage.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'matches' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                            <h2 className="text-lg font-black uppercase tracking-widest text-white">Match Schedule</h2>
                        </div>
                        
                        {tournament.groups && tournament.groups.some(g => g.matches.length > 0) ? (
                            <div className="space-y-8">
                                {tournament.groups.map(group => group.matches.length > 0 && (
                                    <div key={group.id} className="space-y-4">
                                        <h3 className="text-md font-black text-brand-500 uppercase tracking-widest">{group.name} Matches</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {group.matches.map(match => {
                                                const team1 = group.teams.find(t => t.id === match.team1Id);
                                                const team2 = group.teams.find(t => t.id === match.team2Id);
                                                return (
                                                    <div key={match.id} className="bg-surface border border-gray-800 rounded-xl p-4">
                                                        <div className="flex justify-between items-center mb-4">
                                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Round {match.round}</span>
                                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                                                                match.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                                                match.status === 'live' ? 'bg-red-500/10 text-red-500' :
                                                                'bg-gray-800 text-gray-400'
                                                            }`}>
                                                                {match.status}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm font-bold text-white">{team1?.name || 'TBD'}</span>
                                                                <span className="text-lg font-black text-brand-500">{match.score1}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm font-bold text-white">{team2?.name || 'TBD'}</span>
                                                                <span className="text-lg font-black text-brand-500">{match.score2}</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 pt-4 border-t border-gray-800">
                                                            <button 
                                                                onClick={() => {
                                                                    setSelectedMatch({ groupId: group.id, match });
                                                                    setMatchScore({ score1: match.score1, score2: match.score2, status: match.status });
                                                                    setIsUpdateScoreModalOpen(true);
                                                                }}
                                                                className="w-full bg-dark hover:bg-gray-800 text-gray-400 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                                            >
                                                                Update Score
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400 font-medium">No matches scheduled.</p>
                                <p className="text-sm text-gray-500 mt-2">Generate matches from the Groups tab.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'brackets' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                            <h2 className="text-lg font-black uppercase tracking-widest text-white">Knockout Brackets</h2>
                            <button 
                                onClick={handleGenerateBracket}
                                disabled={tournament.bracketMatches && tournament.bracketMatches.length > 0}
                                className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Generate Bracket
                            </button>
                        </div>
                        
                        {tournament.bracketMatches && tournament.bracketMatches.length > 0 ? (
                            <div className="overflow-x-auto pb-8 custom-scrollbar">
                                <div className="flex gap-12 min-w-max">
                                    {/* Group matches by round */}
                                    {Array.from(new Set(tournament.bracketMatches.map(m => m.round))).sort().map(round => {
                                        const roundMatches = tournament.bracketMatches!.filter(m => m.round === round);
                                        return (
                                            <div key={round} className="flex flex-col gap-8 justify-center min-w-[250px]">
                                                <h3 className="text-center text-sm font-black text-gray-500 uppercase tracking-widest mb-4">
                                                    {round === Math.max(...tournament.bracketMatches!.map(m => m.round)) ? 'Finals' : 
                                                     round === Math.max(...tournament.bracketMatches!.map(m => m.round)) - 1 ? 'Semi-Finals' : 
                                                     `Round ${round}`}
                                                </h3>
                                                {roundMatches.map(match => {
                                                    // Find team names (they might be in groups or we might need to fetch them)
                                                    // For now, just use IDs or 'TBD'
                                                    const team1Name = match.team1Id === 'TBD' ? 'TBD' : tournament.groups?.flatMap(g => g.teams).find(t => t.id === match.team1Id)?.name || match.team1Id;
                                                    const team2Name = match.team2Id === 'TBD' ? 'TBD' : tournament.groups?.flatMap(g => g.teams).find(t => t.id === match.team2Id)?.name || match.team2Id;

                                                    return (
                                                        <div key={match.id} className="bg-surface border border-gray-800 rounded-xl p-4 relative">
                                                            {/* Connector lines could be added here using pseudo-elements or SVGs */}
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                    <span className="text-sm font-bold text-white truncate max-w-[150px]">{team1Name}</span>
                                                                    <span className="text-lg font-black text-brand-500">{match.score1}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                    <span className="text-sm font-bold text-white truncate max-w-[150px]">{team2Name}</span>
                                                                    <span className="text-lg font-black text-brand-500">{match.score2}</span>
                                                                </div>
                                                            </div>
                                                            <button 
                                                                onClick={() => {
                                                                    setSelectedMatch({ groupId: 'bracket', match });
                                                                    setMatchScore({ score1: match.score1, score2: match.score2, status: match.status });
                                                                    setIsUpdateScoreModalOpen(true);
                                                                }}
                                                                className="w-full mt-3 bg-dark hover:bg-gray-800 text-gray-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-gray-800"
                                                            >
                                                                Update
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400 font-medium">Bracket not generated.</p>
                                <p className="text-sm text-gray-500 mt-2">Advance teams from the group stage to generate the knockout bracket.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Group Modal */}
            <Modal isOpen={isCreateGroupModalOpen} onClose={() => setIsCreateGroupModalOpen(false)} title="Create New Group">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Group Name</label>
                        <input 
                            type="text" 
                            value={newGroup.name}
                            onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                            placeholder="e.g., Group A, Region East"
                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Team Limit</label>
                        <input 
                            type="number" 
                            value={newGroup.teamLimit}
                            onChange={(e) => setNewGroup({...newGroup, teamLimit: parseInt(e.target.value) || 0})}
                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                        />
                    </div>
                    <div className="flex items-center justify-between bg-dark p-3 rounded-xl border border-gray-800">
                        <div>
                            <p className="text-sm font-bold text-white">Public Group</p>
                            <p className="text-xs text-gray-500">Anyone can join if they have the link</p>
                        </div>
                        <button 
                            onClick={() => setNewGroup({...newGroup, isPublic: !newGroup.isPublic})}
                            className={`w-12 h-6 rounded-full transition-colors relative ${newGroup.isPublic ? 'bg-brand-500' : 'bg-gray-700'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${newGroup.isPublic ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {!newGroup.isPublic && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Passcode</label>
                            <input 
                                type="text" 
                                value={newGroup.passCode}
                                onChange={(e) => setNewGroup({...newGroup, passCode: e.target.value})}
                                placeholder="Enter a secure passcode"
                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                            />
                        </div>
                    )}
                    <div className="pt-4 flex gap-3">
                        <button 
                            onClick={() => setIsCreateGroupModalOpen(false)}
                            className="flex-1 bg-dark hover:bg-gray-800 text-white py-3 rounded-xl font-bold transition border border-gray-800"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleCreateGroup}
                            disabled={!newGroup.name.trim()}
                            className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition"
                        >
                            Create Group
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Manage Teams Modal */}
            <Modal isOpen={isManageTeamsModalOpen} onClose={() => setIsManageTeamsModalOpen(false)} title={`Manage Teams: ${selectedGroup?.name}`} maxWidth="max-w-4xl">
                {selectedGroup && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[60vh]">
                        {/* Assigned Teams */}
                        <div className="flex flex-col h-full bg-dark rounded-xl border border-gray-800 overflow-hidden">
                            <div className="p-4 border-b border-gray-800 bg-surface flex justify-between items-center">
                                <h3 className="font-black text-white uppercase tracking-widest text-sm">Assigned Teams</h3>
                                <span className="text-xs font-bold text-gray-500">{selectedGroup.teams.length} / {selectedGroup.teamLimit}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                {selectedGroup.teams.length > 0 ? (
                                    selectedGroup.teams.map(team => (
                                        <div key={team.id} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-gray-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden">
                                                    {team.logoUrl ? (
                                                        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                                                            {team.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{team.name}</p>
                                                    <p className="text-[10px] text-gray-500">{team.players.length} Players</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveTeam(team.id)}
                                                className="text-gray-500 hover:text-red-500 transition-colors p-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <Users className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm">No teams assigned yet</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Available Teams */}
                        <div className="flex flex-col h-full bg-dark rounded-xl border border-gray-800 overflow-hidden">
                            <div className="p-4 border-b border-gray-800 bg-surface flex justify-between items-center">
                                <h3 className="font-black text-white uppercase tracking-widest text-sm">Available Teams</h3>
                                <span className="text-xs font-bold text-gray-500">{availableTeams.length} Total</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                {fetchingParticipants ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
                                    </div>
                                ) : availableTeams.length > 0 ? (
                                    availableTeams.map((team: any) => (
                                        <div key={team.id} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-gray-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden">
                                                    {team.logoUrl ? (
                                                        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                                                            {team.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{team.name}</p>
                                                    <p className="text-[10px] text-gray-500">{team.players.length} Players</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleAssignTeam(team.participantId)}
                                                disabled={selectedGroup.teams.length >= selectedGroup.teamLimit}
                                                className="bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                                            >
                                                Assign
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <Users className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm text-center px-4">All registered teams have been assigned to groups.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
            {/* Update Score Modal */}
            <Modal isOpen={isUpdateScoreModalOpen} onClose={() => setIsUpdateScoreModalOpen(false)} title="Update Match Score">
                {selectedMatch && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 text-center">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                    {selectedMatch.groupId === 'bracket' 
                                        ? (selectedMatch.match.team1Id === 'TBD' ? 'TBD' : tournament.groups?.flatMap(g => g.teams).find(t => t.id === selectedMatch.match.team1Id)?.name || selectedMatch.match.team1Id)
                                        : (tournament.groups?.find(g => g.id === selectedMatch.groupId)?.teams.find(t => t.id === selectedMatch.match.team1Id)?.name || 'Team 1')}
                                </p>
                                <input 
                                    type="number" 
                                    value={matchScore.score1}
                                    onChange={(e) => setMatchScore({...matchScore, score1: parseInt(e.target.value) || 0})}
                                    className="w-full bg-surface border border-gray-700 text-white text-center text-2xl font-black rounded-lg p-2 focus:border-brand-500 outline-none transition"
                                />
                            </div>
                            <div className="bg-dark p-4 rounded-xl border border-gray-800 text-center">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                    {selectedMatch.groupId === 'bracket' 
                                        ? (selectedMatch.match.team2Id === 'TBD' ? 'TBD' : tournament.groups?.flatMap(g => g.teams).find(t => t.id === selectedMatch.match.team2Id)?.name || selectedMatch.match.team2Id)
                                        : (tournament.groups?.find(g => g.id === selectedMatch.groupId)?.teams.find(t => t.id === selectedMatch.match.team2Id)?.name || 'Team 2')}
                                </p>
                                <input 
                                    type="number" 
                                    value={matchScore.score2}
                                    onChange={(e) => setMatchScore({...matchScore, score2: parseInt(e.target.value) || 0})}
                                    className="w-full bg-surface border border-gray-700 text-white text-center text-2xl font-black rounded-lg p-2 focus:border-brand-500 outline-none transition"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Match Status</label>
                            <select 
                                value={matchScore.status}
                                onChange={(e) => setMatchScore({...matchScore, status: e.target.value as any})}
                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 outline-none transition"
                            >
                                <option value="scheduled">Scheduled</option>
                                <option value="live">Live</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button 
                                onClick={() => setIsUpdateScoreModalOpen(false)}
                                className="flex-1 bg-dark hover:bg-gray-800 text-white py-3 rounded-xl font-bold transition border border-gray-800"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleUpdateScore}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition"
                            >
                                Save Score
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
