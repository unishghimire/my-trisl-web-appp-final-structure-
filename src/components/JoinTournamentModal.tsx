import React, { useState, useEffect } from 'react';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, UserProfile } from '../types';
import Modal from './Modal';
import { useNotification } from '../context/NotificationContext';
import { NotificationService } from '../services/NotificationService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface JoinTournamentModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    profile: UserProfile;
    teamMembers: any[];
    onSuccess: () => void;
}

const JoinTournamentModal: React.FC<JoinTournamentModalProps> = ({
    isOpen,
    onClose,
    tournament,
    profile,
    teamMembers,
    onSuccess
}) => {
    const { user } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();
    
    const [teammate1, setTeammate1] = useState('');
    const [teammate2, setTeammate2] = useState('');
    const [teammate3, setTeammate3] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!user || !tournament || !profile) return;

        if (tournament.teamType === 'duo' && !teammate1) {
            showToast("Please provide your teammate's in-game name.", "warning");
            return;
        }
        if (tournament.teamType === 'squad' && (!teammate1 || !teammate2 || !teammate3)) {
            showToast("Please provide all teammates' in-game names.", "warning");
            return;
        }

        setLoading(true);
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

                // Update user balance and XP
                const currentXP = uData.xp || 0;
                const newXP = currentXP + 50; // Award 50 XP for joining
                const newLevel = Math.floor(newXP / 500) + 1;

                transaction.update(userRef, { 
                    balance: uData.balance - tData.entryFee,
                    xp: newXP,
                    level: newLevel
                });
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

            await NotificationService.create(
                user.uid,
                'Tournament Joined!',
                `You have successfully joined ${tournament.title}. Good luck!`,
                'success',
                `/details/${tournament.id}`
            );
            
            showToast('Joined Successfully!', 'success');
            onSuccess();
            onClose();
            navigate('/dashboard');
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Join ${tournament.teamType.toUpperCase()} Tournament`}>
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
                    <button 
                        onClick={onClose} 
                        disabled={loading}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition uppercase text-sm disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={loading}
                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition uppercase text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : 'Confirm Join'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default JoinTournamentModal;
