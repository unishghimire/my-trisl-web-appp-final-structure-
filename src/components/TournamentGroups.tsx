import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, LobbyGroup, GroupTeam, GroupMatch, Participant } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Shield, Settings, Shuffle, Play, Trophy, ChevronRight, Eye, EyeOff, Check, X } from 'lucide-react';

interface TournamentGroupsProps {
    tournament: Tournament;
    isOrganizer: boolean;
    participants: Participant[];
}

const TournamentGroups: React.FC<TournamentGroupsProps> = ({ tournament, isOrganizer, participants }) => {
    const { user } = useAuth();
    const { showToast } = useNotification();
    const [groups, setGroups] = useState<LobbyGroup[]>([]);
    const [loading, setLoading] = useState(true);

    // States for Organizer Panel
    const [roadmapRound, setRoadmapRound] = useState(1);
    const [numGroups, setNumGroups] = useState(1);
    const [qualRule, setQualRule] = useState(5);
    const [selectedGroup, setSelectedGroup] = useState<LobbyGroup | null>(null);
    const [groupEditMode, setGroupEditMode] = useState(false);

    useEffect(() => {
        fetchGroups();
    }, [tournament.id, user]);

    const fetchGroups = async () => {
        if (!user && !isOrganizer) {
            setGroups([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let q;
            if (isOrganizer) {
                // Organizers can see all
                q = query(collection(db, `tournaments/${tournament.id}/groups`));
            } else {
                // Players see only their groups
                q = query(collection(db, `tournaments/${tournament.id}/groups`), where('allowedUserIds', 'array-contains', user?.uid));
            }
            const snap = await getDocs(q);
            const fetched = snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as LobbyGroup));
            
            // Sort by round, then name
            fetched.sort((a, b) => {
                if (a.round !== b.round) return a.round - b.round;
                return a.name.localeCompare(b.name);
            });
            
            setGroups(fetched);
        } catch (error) {
            console.error("Error fetching groups:", error);
            // Ignore permission error silently for non-authorized.
        } finally {
            setLoading(false);
        }
    };

    const handleAutoDistribute = async () => {
        if (!window.confirm(`Auto-distribute to Round ${roadmapRound} with ${numGroups} groups?`)) return;
        
        try {
            const batch = writeBatch(db);
            let teamsToDistribute: GroupTeam[] = [];
            
            if (roadmapRound === 1) {
                // For Round 1, take ALL participants
                // If it's a team tournament, we group by teamName.
                const teamMap = new Map<string, Participant[]>();
                participants.forEach(p => {
                    const key = p.teamId || p.teamName || p.userId;
                    if (!teamMap.has(key)) teamMap.set(key, []);
                    teamMap.get(key)!.push(p);
                });
                
                teamMap.forEach((members, key) => {
                    teamsToDistribute.push({
                        id: key,
                        name: members[0].teamName || members[0].username,
                        score: 0,
                        rank: 0,
                        isQualified: false,
                        players: members.map(m => m.userId)
                    });
                });
            } else {
                // For subsequent rounds, look at previous round's qualified teams
                const prevRoundGroups = groups.filter(g => g.round === roadmapRound - 1);
                if (prevRoundGroups.length === 0) {
                    throw new Error("No previous round groups found to qualify from.");
                }
                
                prevRoundGroups.forEach(g => {
                    const qualified = g.teams.filter(t => t.isQualified);
                    // Reset their scores for the new round
                    teamsToDistribute.push(...qualified.map(q => ({
                        ...q,
                        score: 0,
                        rank: 0,
                        isQualified: false
                    })));
                });
            }
            
            if (teamsToDistribute.length === 0) {
                showToast("No teams to distribute!", "error");
                return;
            }

            // Shuffle teams randomly
            teamsToDistribute = teamsToDistribute.sort(() => Math.random() - 0.5);

            // Distribute evenly
            const splitGroups: GroupTeam[][] = Array.from({ length: numGroups }, () => []);
            teamsToDistribute.forEach((team, idx) => {
                splitGroups[idx % numGroups].push(team);
            });

            // Calculate current max round to increment roadmap
            await updateDoc(doc(db, 'tournaments', tournament.id), {
                currentRound: roadmapRound
            });

            // Create groups
            for (let i = 0; i < numGroups; i++) {
                const newGroupRef = doc(collection(db, `tournaments/${tournament.id}/groups`));
                // Extract all UIDs for permission array
                const allowedUserIds = splitGroups[i].flatMap(t => t.players);
                
                const newGroup: LobbyGroup = {
                    id: newGroupRef.id,
                    tournamentId: tournament.id,
                    round: roadmapRound,
                    name: `Round ${roadmapRound} - Group ${String.fromCharCode(65 + i)}`,
                    allowedUserIds,
                    teams: splitGroups[i],
                    matches: [],
                    qualificationRule: qualRule,
                    roomId: '',
                    roomPass: '',
                    status: 'upcoming'
                };
                
                batch.set(newGroupRef, newGroup);
            }

            await batch.commit();
            showToast("Groups successfully auto-generated!", "success");
            fetchGroups();
            setRoadmapRound(r => r + 1);
        } catch (e: any) {
            showToast(e.message, "error");
        }
    };

    const handleUpdateGroupData = async (groupId: string, data: Partial<LobbyGroup>) => {
        try {
            await updateDoc(doc(db, `tournaments/${tournament.id}/groups`, groupId), data);
            showToast("Group updated successfully!", "success");
            fetchGroups();
            if (data.status === 'completed' && selectedGroup && selectedGroup.id === groupId) {
                 setSelectedGroup({ ...selectedGroup, ...data } as LobbyGroup);
            }
        } catch (e: any) {
            showToast("Error updating group", "error");
        }
    };

    const handleUpdateTeamScore = (group: LobbyGroup, teamId: string, score: number) => {
        const updatedTeams = group.teams.map(t => t.id === teamId ? { ...t, score } : t)
            .sort((a, b) => b.score - a.score)
            .map((t, idx) => ({
                ...t,
                rank: idx + 1,
                isQualified: idx < group.qualificationRule
            }));
            
        setSelectedGroup({ ...group, teams: updatedTeams });
    };

    const saveGroupEdits = async () => {
        if (!selectedGroup) return;
        try {
            await updateDoc(doc(db, `tournaments/${tournament.id}/groups`, selectedGroup.id), {
                teams: selectedGroup.teams,
                roomId: selectedGroup.roomId,
                roomPass: selectedGroup.roomPass,
                status: selectedGroup.status
            });
            showToast("Saved!", "success");
            setGroupEditMode(false);
            fetchGroups();
        } catch (e) {
            showToast("Save failed", "error");
        }
    };

    if (loading) return <div className="text-center p-8 text-gray-500 font-bold">Loading Lobbies...</div>;

    if (!isOrganizer && groups.length === 0) {
        return (
            <div className="bg-surface p-8 rounded-3xl border border-gray-800 text-center">
                <Shield className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-white font-black text-xl tracking-tighter mb-2">RESTRICTED ACCESS</h3>
                <p className="text-gray-500 font-bold text-sm">
                    You do not have access to any lobbies. Only registered and assigned teams can view lobby details.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ORGANIZER CONTROLS */}
            {isOrganizer && (
                <div className="bg-brand-900/10 border border-brand-500/30 p-6 rounded-3xl">
                    <h3 className="text-brand-500 font-black text-lg uppercase tracking-widest flex items-center gap-2 mb-6">
                        <Settings className="w-5 h-5" /> Tournament Director
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Target Round</label>
                            <input 
                                type="number" 
                                value={roadmapRound} 
                                onChange={e => setRoadmapRound(Number(e.target.value))}
                                className="w-full bg-dark border border-gray-800 rounded-xl px-4 py-3 text-white font-black"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Number of Groups</label>
                            <input 
                                type="number" 
                                value={numGroups} 
                                onChange={e => setNumGroups(Number(e.target.value))}
                                className="w-full bg-dark border border-gray-800 rounded-xl px-4 py-3 text-white font-black"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">QualTop N</label>
                            <input 
                                type="number" 
                                value={qualRule} 
                                onChange={e => setQualRule(Number(e.target.value))}
                                className="w-full bg-dark border border-gray-800 rounded-xl px-4 py-3 text-white font-black"
                            />
                        </div>
                        <button 
                            onClick={handleAutoDistribute}
                            className="bg-brand-600 hover:bg-brand-500 text-white font-black uppercase tracking-widest px-4 py-3 rounded-xl flex justify-center items-center gap-2 transition-colors h-[46px]"
                        >
                            <Shuffle className="w-4 h-4" /> Auto Distribute
                        </button>
                    </div>
                </div>
            )}

            {/* GROUPS LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map(g => (
                    <div key={g.id} className="bg-surface rounded-2xl border border-gray-800 p-5 hover:border-brand-500/30 transition-all cursor-pointer shadow-lg" onClick={() => setSelectedGroup(g)}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-[10px] text-brand-500 font-black uppercase tracking-widest">Round {g.round}</div>
                                <h4 className="text-white font-black text-xl tracking-tighter">{g.name}</h4>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border ${g.status === 'live' ? 'bg-red-500/20 text-red-400 border-red-500/20' : g.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' : 'bg-green-500/20 text-green-400 border-green-500/20'}`}>
                                {g.status}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs font-bold text-gray-500">
                            <div>Teams: <span className="text-white">{g.teams.length}</span></div>
                            <div>Qualifies: <span className="text-white">Top {g.qualificationRule}</span></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* GROUP DETAILS / EDIT MODAL-LIKE VIEW */}
            {selectedGroup && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" style={{margin:0}}>
                    <div className="bg-surface border border-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col relative">
                        <button onClick={() => { setSelectedGroup(null); setGroupEditMode(false); }} className="absolute top-6 right-6 p-2 bg-dark rounded-full text-gray-400 hover:text-white transition-colors border border-gray-800">
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="p-8 pb-4 border-b border-gray-800">
                            <div className="text-[10px] text-brand-500 font-black uppercase tracking-widest">Round {selectedGroup.round}</div>
                            <h2 className="text-3xl font-black text-white tracking-tighter">{selectedGroup.name}</h2>
                        </div>

                        <div className="p-8 space-y-8 flex-1">
                            {/* Player / View credentials */}
                            <div className="bg-dark p-6 rounded-2xl border border-gray-800">
                                <h3 className="text-brand-500 font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
                                    <Shield className="w-4 h-4" /> Lobby Credentials
                                </h3>
                                {isOrganizer && groupEditMode ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="text" placeholder="Room ID" value={selectedGroup.roomId} onChange={e => setSelectedGroup({...selectedGroup, roomId: e.target.value})} className="bg-surface border border-gray-700 px-4 py-2 rounded-xl text-white outline-none" />
                                        <input type="text" placeholder="Password" value={selectedGroup.roomPass} onChange={e => setSelectedGroup({...selectedGroup, roomPass: e.target.value})} className="bg-surface border border-gray-700 px-4 py-2 rounded-xl text-white outline-none" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-surface rounded-xl border border-gray-800">
                                            <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Room ID</div>
                                            <div className="text-white font-mono text-xl">{selectedGroup.roomId || 'TBA'}</div>
                                        </div>
                                        <div className="p-4 bg-surface rounded-xl border border-gray-800">
                                            <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Password</div>
                                            <div className="text-white font-mono text-xl">{selectedGroup.roomPass || 'TBA'}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Teams and Results */}
                            <div>
                                <h3 className="text-white font-black text-lg uppercase tracking-tighter mb-4 flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard / Results
                                </h3>
                                <div className="space-y-2">
                                    {selectedGroup.teams.map((t, idx) => {
                                        const qual = idx < selectedGroup.qualificationRule;
                                        return (
                                            <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl border ${qual ? 'bg-green-500/5 border-green-500/20' : 'bg-dark border-gray-800'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${qual ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                                                        #{t.rank || idx + 1}
                                                    </div>
                                                    <div className="text-white font-bold">{t.name}</div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {isOrganizer && groupEditMode ? (
                                                        <input 
                                                            type="number" 
                                                            value={t.score} 
                                                            onChange={e => handleUpdateTeamScore(selectedGroup, t.id, Number(e.target.value))}
                                                            className="w-20 bg-surface border border-gray-700 rounded-lg px-2 py-1 text-center text-white outline-none"
                                                        />
                                                    ) : (
                                                        <div className="font-mono text-brand-400 font-bold">{t.score} PTS</div>
                                                    )}
                                                    {qual && <Check className="w-5 h-5 text-green-500" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        {isOrganizer && (
                            <div className="p-8 bg-dark border-t border-gray-800 flex justify-between items-center shrink-0">
                                <div className="flex gap-2">
                                    <button onClick={() => handleUpdateGroupData(selectedGroup.id, {status: 'live'})} className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-red-500/20 text-red-500 border border-red-500/20 hover:bg-red-500/30">Set Live</button>
                                    <button onClick={() => handleUpdateGroupData(selectedGroup.id, {status: 'completed'})} className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-blue-500/20 text-blue-500 border border-blue-500/20 hover:bg-blue-500/30">Set Completed</button>
                                </div>
                                <div className="flex gap-2">
                                    {groupEditMode ? (
                                        <>
                                            <button onClick={() => setGroupEditMode(false)} className="px-6 py-3 rounded-xl text-xs font-black uppercase text-gray-400 hover:text-white transition-colors">Cancel</button>
                                            <button onClick={saveGroupEdits} className="px-6 py-3 rounded-xl text-xs font-black uppercase bg-brand-600 text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500">Save Edits</button>
                                        </>
                                    ) : (
                                        <button onClick={() => setGroupEditMode(true)} className="px-6 py-3 rounded-xl text-xs font-black uppercase bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 border border-brand-500/20">Edit Group</button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TournamentGroups;
