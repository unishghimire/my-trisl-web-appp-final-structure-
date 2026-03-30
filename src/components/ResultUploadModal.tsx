import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Tournament, UserProfile } from '../types';
import Modal from './Modal';
import { Upload, User, Plus, Trash2, Save, FileText } from 'lucide-react';
import { NotificationService } from '../services/NotificationService';

interface ResultUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    onSuccess: () => void;
}

const ResultUploadModal: React.FC<ResultUploadModalProps> = ({ isOpen, onClose, tournament, onSuccess }) => {
    const [activeTab, setActiveTab] = useState<'file' | 'manual'>('file');
    const [participants, setParticipants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [resultFile, setResultFile] = useState<File | null>(null);
    const [resultUrl, setResultUrl] = useState('');
    const [winners, setWinners] = useState<{ uid: string; amount: number; rank: number; username: string }[]>([]);

    useEffect(() => {
        if (isOpen && tournament.id) {
            const fetchParticipants = async () => {
                try {
                    const q = query(collection(db, 'participants'), where('tournamentId', '==', tournament.id));
                    const snap = await getDocs(q);
                    setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                } catch (error) {
                    console.error("Error fetching participants:", error);
                }
            };
            fetchParticipants();

            // Pre-fill winners based on prize distribution if available
            if (tournament.prizeDistribution) {
                setWinners(tournament.prizeDistribution.map(p => ({
                    uid: '',
                    username: '',
                    amount: p.amount,
                    rank: p.rank
                })));
            } else {
                setWinners([{ uid: '', username: '', amount: 0, rank: 1 }]);
            }
        }
    }, [isOpen, tournament]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const storageRef = ref(storage, `results/${tournament.id}_${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setResultUrl(url);
            setResultFile(file);
        } catch (error) {
            console.error("Error uploading result file:", error);
            alert("Failed to upload file");
        } finally {
            setLoading(false);
        }
    };

    const handleAddWinner = () => {
        const nextRank = winners.length + 1;
        setWinners([...winners, { uid: '', username: '', amount: 0, rank: nextRank }]);
    };

    const handleRemoveWinner = (index: number) => {
        setWinners(winners.filter((_, i) => i !== index));
    };

    const handleWinnerChange = (index: number, field: string, value: any) => {
        const newWinners = [...winners];
        if (field === 'uid') {
            const p = participants.find(part => part.userId === value);
            newWinners[index] = { 
                ...newWinners[index], 
                uid: value, 
                username: p ? p.username : '' 
            };
        } else {
            newWinners[index] = { ...newWinners[index], [field]: value };
        }
        setWinners(newWinners);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const tRef = doc(db, 'tournaments', tournament.id);
            
            const validWinners = winners.filter(w => w.uid !== '').map(({ uid, amount, rank, username }) => ({ userId: uid, prize: amount, rank, username }));

            batch.update(tRef, {
                status: 'completed',
                resultUrl: resultUrl,
                winners: validWinners,
                completedAt: serverTimestamp()
            });

            // Update winners' total earnings and sync to users_public
            for (const winner of validWinners) {
                const userRef = doc(db, 'users', winner.userId);
                const publicRef = doc(db, 'users_public', winner.userId);
                
                batch.update(userRef, {
                    totalEarnings: increment(winner.prize),
                    balance: increment(winner.prize) // Also add to balance
                });
                
                batch.set(publicRef, {
                    totalEarnings: increment(winner.prize),
                    updatedAt: serverTimestamp()
                }, { merge: true });

                // Create a transaction record for the prize
                const txRef = doc(collection(db, 'transactions'));
                batch.set(txRef, {
                    userId: winner.userId,
                    amount: winner.prize,
                    type: 'prize',
                    description: `Prize for ${tournament.title} (Rank ${winner.rank})`,
                    status: 'success',
                    timestamp: serverTimestamp(),
                    tournamentId: tournament.id
                });
            }

            await batch.commit();
            
            // Notify participants
            await NotificationService.notifyParticipants(
                tournament.id,
                'Results Uploaded!',
                `Final results for ${tournament.title} are now available. Check the leaderboard!`,
                'success',
                `/details/${tournament.id}`
            );

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error uploading results:", error);
            alert("Failed to upload results. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Upload Results: ${tournament.title}`}>
            <div className="space-y-6">
                <div className="flex border-b border-gray-700">
                    <button 
                        onClick={() => setActiveTab('file')}
                        className={`flex-1 py-2 text-sm font-bold transition ${activeTab === 'file' ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Upload className="w-4 h-4" /> File Upload
                        </div>
                    </button>
                    <button 
                        onClick={() => setActiveTab('manual')}
                        className={`flex-1 py-2 text-sm font-bold transition ${activeTab === 'manual' ? 'text-brand-400 border-b-2 border-brand-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <User className="w-4 h-4" /> Manual Entry
                        </div>
                    </button>
                </div>

                {activeTab === 'file' ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-400">Upload a screenshot or document containing the final match results.</p>
                        <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-brand-500 transition cursor-pointer relative group">
                            <input 
                                type="file" 
                                onChange={handleFileChange}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept="image/*,.pdf,.csv"
                            />
                            <div className="flex flex-col items-center">
                                <Upload className="w-10 h-10 text-gray-600 group-hover:text-brand-500 mb-2" />
                                <span className="text-sm text-gray-500 group-hover:text-gray-300">
                                    {resultFile ? resultFile.name : 'Click or drag to upload result file'}
                                </span>
                            </div>
                        </div>
                        {resultUrl && (
                            <div className="mt-4">
                                <p className="text-xs text-gray-500 mb-2 uppercase font-bold">Preview:</p>
                                <img src={resultUrl} alt="Result Preview" className="w-full h-40 object-cover rounded-lg border border-gray-700" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-gray-300 uppercase">Winner List</h4>
                            <button 
                                onClick={handleAddWinner}
                                className="text-xs bg-gray-800 hover:bg-gray-700 text-brand-400 px-2 py-1 rounded flex items-center gap-1 transition"
                            >
                                <Plus className="w-3 h-3" /> Add Row
                            </button>
                        </div>
                        {winners.map((winner, index) => (
                            <div key={index} className="bg-surface p-3 rounded-lg border border-gray-700 space-y-3 relative">
                                <div className="flex gap-3">
                                    <div className="w-16">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Rank</label>
                                        <input 
                                            type="number" 
                                            value={winner.rank}
                                            onChange={(e) => handleWinnerChange(index, 'rank', parseInt(e.target.value))}
                                            className="w-full bg-dark border border-gray-700 rounded p-1.5 text-sm text-white focus:border-brand-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Participant</label>
                                        <select 
                                            value={winner.uid}
                                            onChange={(e) => handleWinnerChange(index, 'uid', e.target.value)}
                                            className="w-full bg-dark border border-gray-700 rounded p-1.5 text-sm text-white focus:border-brand-500 outline-none"
                                        >
                                            <option value="">Select Player</option>
                                            {participants.map(p => (
                                                <option key={p.userId} value={p.userId}>{p.username} ({p.inGameId})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-24">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Prize</label>
                                        <input 
                                            type="number" 
                                            value={winner.amount}
                                            onChange={(e) => handleWinnerChange(index, 'amount', parseInt(e.target.value))}
                                            className="w-full bg-dark border border-gray-700 rounded p-1.5 text-sm text-white focus:border-brand-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <button 
                                            onClick={() => handleRemoveWinner(index)}
                                            className="text-red-500 hover:text-red-400 p-1 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="pt-4 border-t border-gray-700 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={loading || (activeTab === 'file' && !resultFile && !resultUrl) || (activeTab === 'manual' && winners.every(w => w.uid === ''))}
                        className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Save className="w-5 h-5" /> Finalize Results
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ResultUploadModal;
