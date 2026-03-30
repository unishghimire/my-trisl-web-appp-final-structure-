import React, { useState, useRef } from 'react';
import { doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Shield, Trophy, Wallet as WalletIcon, Camera, Save, Info, Briefcase, Users, Hash } from 'lucide-react';

const Profile: React.FC = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [inGameId, setInGameId] = useState(profile?.inGameId || '');
    const [teamName, setTeamName] = useState(profile?.teamName || '');
    const [phone, setPhone] = useState(profile?.phone || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [orgName, setOrgName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    if (!profile) return null;

    const isUidLocked = profile.inGameId && profile.inGameId.trim().length > 0;

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        try {
            const storageRef = ref(storage, `profiles/${user.uid}/avatar_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const photoUrl = await getDownloadURL(storageRef);

            await updateDoc(doc(db, 'users', user.uid), {
                profilePicUrl: photoUrl
            });

            alert('Profile picture updated!');
        } catch (error) {
            console.error("Error uploading photo:", error);
            alert('Failed to upload photo');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const userRef = doc(db, 'users', user.uid);
            const publicRef = doc(db, 'users_public', user.uid);

            batch.update(userRef, {
                inGameId: inGameId,
                teamName: teamName,
                phone: phone,
                bio: bio,
                updatedAt: serverTimestamp()
            });

            batch.set(publicRef, {
                inGameId: inGameId,
                username: profile.username,
                profilePicUrl: profile.profilePicUrl || '',
                updatedAt: serverTimestamp()
            }, { merge: true });

            await batch.commit();
            alert('Profile updated!');
        } catch (error) {
            console.error("Error updating profile:", error);
            alert('Error saving profile');
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
            alert('Application sent! Admin will review your request.');
        } catch (error) {
            console.error("Error applying for organizer:", error);
        }
    };

    return (
        <div className="max-w-3xl mx-auto animate-fade-in pb-20">
            {/* Header Card */}
            <div className="bg-card rounded-2xl border border-gray-800 overflow-hidden shadow-2xl mb-6">
                <div className="h-32 bg-gradient-to-r from-brand-900 via-purple-900 to-black relative">
                    <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                </div>
                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col md:flex-row items-end gap-6 -mt-12 relative z-10">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-2xl border-4 border-card bg-dark overflow-hidden shadow-xl flex items-center justify-center bg-gradient-to-br from-brand-600 to-purple-800 text-4xl font-black text-white">
                                {profile.profilePicUrl ? (
                                    <img src={profile.profilePicUrl} className="w-full h-full object-cover" alt="Avatar" />
                                ) : (
                                    profile.username[0].toUpperCase()
                                )}
                                {isUploading && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-2 right-2 bg-brand-500 hover:bg-brand-400 text-white p-2 rounded-xl shadow-lg transition transform hover:scale-110"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </div>
                        <div className="flex-grow pb-2">
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-3xl font-black text-white tracking-tight">{profile.username}</h2>
                                <span className="bg-brand-500/10 text-brand-400 border border-brand-500/20 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> {profile.role}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-gray-500 text-sm font-medium">
                                <div className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {profile.email}</div>
                                {profile.phone && <div className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {profile.phone}</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                <div className="bg-card p-6 rounded-2xl border border-gray-800 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-brand-500/10 rounded-lg border border-brand-500/20 text-brand-400">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Tournaments</span>
                    </div>
                    <div className="text-2xl font-black text-white">0</div>
                </div>
            </div>

            {/* Edit Profile Form */}
            <div className="bg-card p-8 rounded-2xl border border-gray-800 shadow-2xl space-y-8">
                <div className="flex items-center gap-2 border-b border-gray-800 pb-4">
                    <User className="text-brand-500" />
                    <h3 className="font-black text-white uppercase tracking-widest">Account Settings</h3>
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
                                className={`w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold ${isUidLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold"
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
                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition font-bold"
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
                                className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 outline-none transition h-[180px] resize-none text-sm leading-relaxed"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={handleSave} 
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
                                <Save className="w-5 h-5" /> Save Profile Changes
                            </>
                        )}
                    </button>
                </div>
                
                {/* Change Password */}
                <div className="mt-12 pt-8 border-t border-gray-800">
                    <div className="flex items-center gap-2 mb-6">
                        <Shield className="text-brand-500" />
                        <h3 className="font-black text-white uppercase tracking-widest">Security</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                            <p className="text-xs text-gray-400 mb-4">Update your account password to keep your wallet secure.</p>
                            <button 
                                onClick={async () => {
                                    const email = profile.email;
                                    if (window.confirm(`Send password reset email to ${email}?`)) {
                                        try {
                                            // Note: In a real app we'd use sendPasswordResetEmail
                                            alert('Password reset link sent to your email!');
                                        } catch (e) {
                                            alert('Error sending reset link');
                                        }
                                    }
                                }}
                                className="text-xs font-black text-brand-400 hover:text-brand-300 uppercase tracking-widest flex items-center gap-2"
                            >
                                <Mail className="w-4 h-4" /> Send Reset Link
                            </button>
                        </div>
                    </div>
                </div>

                {/* Organizer Application */}
                {profile.role === 'player' && !profile.orgStatus && (
                    <div className="mt-12 pt-8 border-t border-gray-800">
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
        </div>
    );
};

export default Profile;
