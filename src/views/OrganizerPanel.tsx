import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Tournament } from '../types';
import { Plus, Settings, Play, Save, Upload } from 'lucide-react';
import Modal from '../components/Modal';
import { NotificationService } from '../services/NotificationService';
import ResultUploadModal from '../components/ResultUploadModal';

const OrganizerPanel: React.FC = () => {
    const { user, profile } = useAuth();
    const [hostedTournaments, setHostedTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [roomId, setRoomId] = useState('');
    const [roomPass, setRoomPass] = useState('');

    const fetchHosted = async () => {
        if (!user) return;
        try {
            const q = query(
                collection(db, 'tournaments'),
                where('hostUid', '==', user.uid),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            setHostedTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));
        } catch (error) {
            console.error("Error fetching hosted tournaments:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHosted();
    }, [user]);

    const handleManage = (t: Tournament) => {
        setSelectedTournament(t);
        setRoomId(t.roomId || '');
        setRoomPass(t.roomPass || '');
        setIsManageModalOpen(true);
    };

    const handleUpdateStatus = async (status: 'upcoming' | 'live' | 'completed') => {
        if (!selectedTournament) return;
        try {
            const tRef = doc(db, 'tournaments', selectedTournament.id);
            await updateDoc(tRef, {
                roomId,
                roomPass,
                status
            });
            
            if (status === 'live') {
                await NotificationService.notifyParticipants(
                    selectedTournament.id,
                    'Tournament is LIVE!',
                    `${selectedTournament.title} has started! Join the room now.`,
                    'alert',
                    `/details/${selectedTournament.id}`
                );
            } else if (status === 'upcoming' && roomId) {
                await NotificationService.notifyParticipants(
                    selectedTournament.id,
                    'Room Details Updated',
                    `Room ID and Password for ${selectedTournament.title} are now available.`,
                    'info',
                    `/details/${selectedTournament.id}`
                );
            }

            alert(`Tournament is now ${status.toUpperCase()}`);
            setIsManageModalOpen(false);
            fetchHosted();
        } catch (error) {
            console.error("Error updating tournament:", error);
        }
    };

    if (profile?.role !== 'organizer' && profile?.role !== 'admin') {
        return <div className="p-8 text-center text-red-500 bg-card rounded">Access Denied</div>;
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="loader mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono">ESTABLISHING UPLINK...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Organizer Dashboard</h1>
                <button className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg font-bold text-white shadow-lg flex items-center gap-2 transition">
                    <Plus className="w-5 h-5" /> Create New
                </button>
            </div>
            <div className="bg-card p-6 rounded-xl border border-gray-800 min-h-[400px]">
                {hostedTournaments.length > 0 ? (
                    hostedTournaments.map(t => (
                        <div key={t.id} className="bg-surface p-4 rounded-lg flex justify-between items-center mb-3 border border-gray-700">
                            <div>
                                <div className="font-bold text-white">{t.title}</div>
                                <div className="text-xs text-gray-400 mt-1">
                                    <span className={`bg-gray-800 px-2 py-0.5 rounded uppercase font-bold ${t.status === 'live' ? 'text-red-500 animate-pulse' : t.status === 'completed' ? 'text-green-500' : 'text-blue-400'}`}>
                                        {t.status}
                                    </span> 
                                    <span className="ml-2">{t.currentPlayers}/{t.slots} Players</span>
                                </div>
                            </div>
                            <button onClick={() => handleManage(t)} className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition">
                                <Settings className="w-4 h-4" /> Manage
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-gray-500 py-10">
                        You haven't created any tournaments yet.
                    </div>
                )}
            </div>

            <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title={`Manage: ${selectedTournament?.title}`}>
                <div className="space-y-6">
                    <div className="bg-surface p-4 rounded-lg border border-gray-700">
                        <h4 className="font-bold text-gray-400 text-xs uppercase mb-2">Room Credentials</h4>
                        <input 
                            type="text" 
                            value={roomId} 
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="Room ID" 
                            className="w-full bg-dark border border-gray-700 text-white rounded p-2 mb-2 focus:border-brand-500 outline-none"
                        />
                        <input 
                            type="text" 
                            value={roomPass} 
                            onChange={(e) => setRoomPass(e.target.value)}
                            placeholder="Password" 
                            className="w-full bg-dark border border-gray-700 text-white rounded p-2 mb-3 focus:border-brand-500 outline-none"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => handleUpdateStatus('upcoming')} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition">
                                <Save className="w-4 h-4" /> Save Info
                            </button>
                            <button onClick={() => handleUpdateStatus('live')} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded text-sm font-bold animate-pulse flex items-center justify-center gap-2 transition">
                                <Play className="w-4 h-4" /> GO LIVE
                            </button>
                        </div>
                    </div>
                    
                    <div className="border-t border-gray-700 pt-4">
                        <button 
                            onClick={() => {
                                setIsManageModalOpen(false);
                                setIsResultModalOpen(true);
                            }} 
                            className="w-full bg-green-600 hover:bg-green-500 py-3 rounded text-white font-bold shadow-lg transition flex items-center justify-center gap-2"
                        >
                            <Upload className="w-5 h-5" /> Finalize & Upload Results
                        </button>
                    </div>
                </div>
            </Modal>

            {selectedTournament && (
                <ResultUploadModal 
                    isOpen={isResultModalOpen}
                    onClose={() => setIsResultModalOpen(false)}
                    tournament={selectedTournament}
                    onSuccess={fetchHosted}
                />
            )}
        </div>
    );
};

export default OrganizerPanel;
