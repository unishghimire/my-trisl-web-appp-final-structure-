import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { User, Hash, Save, LogOut } from 'lucide-react';

const CompleteProfile: React.FC = () => {
    const { user, profile, logout } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();

    const [inGameId, setInGameId] = useState('');
    const [inGameName, setInGameName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!user || !profile) return null;

    // If already completed, redirect to dashboard
    if (profile.inGameId && profile.inGameName) {
        navigate('/dashboard');
        return null;
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inGameId.trim() || !inGameName.trim()) {
            showToast('Both fields are required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const userRef = doc(db, 'users', user.uid);
            const publicRef = doc(db, 'users_public', user.uid);

            batch.update(userRef, {
                inGameId: inGameId.trim(),
                inGameName: inGameName.trim(),
                updatedAt: serverTimestamp()
            });

            batch.set(publicRef, {
                inGameId: inGameId.trim(),
                inGameName: inGameName.trim(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            await batch.commit();
            showToast('Profile completed! Welcome to NexPlayOrg.', 'success');
            navigate('/dashboard');
        } catch (error) {
            console.error("Error completing profile:", error);
            showToast('Failed to save details', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card border border-gray-800 rounded-3xl p-8 shadow-2xl animate-scale-in">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand-500/20">
                        <User className="w-10 h-10 text-brand-400" />
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Complete Your Profile</h1>
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest leading-relaxed">
                        To participate in tournaments, you must provide your in-game details.
                    </p>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                            <Hash className="w-3 h-3" /> In-Game ID (UID)
                        </label>
                        <input 
                            type="text" 
                            required
                            value={inGameId} 
                            onChange={(e) => setInGameId(e.target.value)}
                            placeholder="e.g. 512345678" 
                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block flex items-center gap-1">
                            <User className="w-3 h-3" /> In-Game Name
                        </label>
                        <input 
                            type="text" 
                            required
                            value={inGameName} 
                            onChange={(e) => setInGameName(e.target.value)}
                            placeholder="Your In-Game Alias" 
                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold"
                        />
                    </div>

                    <div className="pt-4 space-y-4">
                        <button 
                            type="submit"
                            disabled={isSaving}
                            className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-gray-700 text-white py-4 rounded-xl font-black transition shadow-lg uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" /> Finish Setup
                                </>
                            )}
                        </button>

                        <button 
                            type="button"
                            onClick={() => logout()}
                            className="w-full bg-transparent hover:bg-gray-800 text-gray-500 py-3 rounded-xl font-bold transition uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfile;
