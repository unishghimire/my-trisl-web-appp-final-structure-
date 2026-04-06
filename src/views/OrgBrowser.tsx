import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, doc, updateDoc, arrayUnion, arrayRemove, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Search, UserPlus, UserMinus, Building2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const OrgBrowser: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useNotification();
    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [following, setFollowing] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchOrgs();
        if (user) fetchFollowing();
    }, [user]);

    const fetchOrgs = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'users_public'));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));
            console.log("Fetched all users from users_public:", data);
            
            const roles = Array.from(new Set(data.map((d: any) => d.role)));
            console.log("Roles found in users_public:", roles);

            // Filter by role client-side for debugging
            const orgsData = data.filter((d: any) => d.role === 'organizer');
            console.log("Filtered orgs:", orgsData);
            setOrgs(orgsData);
        } catch (error) {
            console.error("Error fetching orgs:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFollowing = async () => {
        if (!user) return;
        try {
            const q = query(collection(db, 'follows'), where('followerId', '==', user.uid));
            const snap = await getDocs(q);
            setFollowing(new Set(snap.docs.map(d => d.data().followingId)));
        } catch (error) {
            console.error("Error fetching following:", error);
        }
    };

    const handleToggleFollow = async (orgId: string) => {
        if (!user) {
            showToast('Please login to follow', 'warning');
            return;
        }
        
        setLoading(true);
        try {
            if (following.has(orgId)) {
                // Unfollow logic
                const q = query(collection(db, 'follows'), where('followerId', '==', user.uid), where('followingId', '==', orgId));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    await deleteDoc(doc(db, 'follows', snap.docs[0].id));
                    showToast('Unfollowed', 'success');
                    setFollowing(prev => {
                        const next = new Set(prev);
                        next.delete(orgId);
                        return next;
                    });
                }
            } else {
                // Follow logic
                await addDoc(collection(db, 'follows'), {
                    followerId: user.uid,
                    followingId: orgId,
                    createdAt: new Date()
                });
                showToast('Followed', 'success');
                setFollowing(prev => new Set(prev).add(orgId));
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
            showToast('Failed to toggle follow', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredOrgs = orgs.filter(o => 
        (o.username && o.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.orgName && o.orgName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const suggestions = orgs.slice(0, 10); // Show up to 10 suggested orgs

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <Building2 className="text-brand-500 w-8 h-8" /> Organizations
                </h1>
                <p className="text-gray-400 mt-1">Discover and follow organizations to get tournament updates.</p>
            </div>

            <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search organizations..."
                    className="w-full bg-card border border-gray-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-brand-500 outline-none transition"
                />
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <>
                    {searchTerm === '' && suggestions.length > 0 && (
                        <div className="mb-12">
                            <h2 className="text-xl font-black text-white uppercase mb-6">Featured Organizations</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {suggestions.map(org => (
                                    <div key={org.uid} className="bg-card rounded-2xl border border-gray-800 p-6 shadow-lg backdrop-blur-md bg-white/5 flex flex-col">
                                        <div className="flex items-center gap-4 mb-4">
                                            <img src={org.profilePicture || undefined} alt={org.username} className="w-16 h-16 rounded-xl bg-dark border border-gray-700" />
                                            <h3 className="text-lg font-black text-white">{org.username}</h3>
                                        </div>
                                        <div className="flex gap-2 mt-auto">
                                            <Link to={`/profile/${org.uid}`} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl text-center font-bold text-sm transition">
                                                View Profile
                                            </Link>
                                            {user && user.uid !== org.uid && (
                                                <button 
                                                    onClick={() => handleToggleFollow(org.uid)}
                                                    className={`px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 ${following.has(org.uid) ? 'bg-gray-700 text-gray-300' : 'bg-brand-600 text-white'}`}
                                                >
                                                    {following.has(org.uid) ? <><UserMinus className="w-4 h-4" /> Unfollow</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <h2 className="text-xl font-black text-white uppercase mb-6">
                        {searchTerm === '' ? 'All Organizations' : 'Search Results'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredOrgs.map(org => (
                            <div key={org.uid} className="bg-card rounded-2xl border border-gray-800 p-6 shadow-lg backdrop-blur-md bg-white/5 flex flex-col">
                                <div className="flex items-center gap-4 mb-4">
                                    <img src={org.profilePicture || undefined} alt={org.username} className="w-16 h-16 rounded-xl bg-dark border border-gray-700" />
                                    <h3 className="text-lg font-black text-white">{org.username}</h3>
                                </div>
                                <div className="flex gap-2 mt-auto">
                                    <Link to={`/profile/${org.uid}`} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl text-center font-bold text-sm transition">
                                        View Profile
                                    </Link>
                                    {user && user.uid !== org.uid && (
                                        <button 
                                            onClick={() => handleToggleFollow(org.uid)}
                                            className={`px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 ${following.has(org.uid) ? 'bg-gray-700 text-gray-300' : 'bg-brand-600 text-white'}`}
                                        >
                                            {following.has(org.uid) ? <><UserMinus className="w-4 h-4" /> Unfollow</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default OrgBrowser;
