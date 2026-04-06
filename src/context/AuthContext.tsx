import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db, auth } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
    user: { uid: string; email: string; username: string; role: string } | null;
    profile: UserProfile | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    profile: null, 
    loading: true,
    logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<{ uid: string; email: string; username: string; role: string } | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const logout = async () => {
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    status: 'offline',
                    lastActive: serverTimestamp()
                });
            } catch (e) {
                console.error("Failed to update status on logout", e);
            }
        }
        await signOut(auth);
        setUser(null);
        setProfile(null);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    const userRef = doc(db, 'users', firebaseUser.uid);
                    const userSnap = await getDoc(userRef);
                    
                    if (!userSnap.exists()) {
                        // Create user document if it doesn't exist (e.g., first Google Sign-In)
                        const newUser = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email || '',
                            username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                            role: 'player',
                            balance: 0,
                            totalEarnings: 0,
                            inGameId: '',
                            inGameName: '',
                            teamName: '',
                            phone: '',
                            isBanned: false,
                            createdAt: serverTimestamp(),
                        };
                        await setDoc(userRef, newUser);
                        
                        // Create public profile
                        await setDoc(doc(db, 'users_public', firebaseUser.uid), {
                            uid: firebaseUser.uid,
                            username: newUser.username,
                            totalEarnings: 0,
                            inGameId: '',
                            inGameName: '',
                            role: 'player',
                            updatedAt: serverTimestamp(),
                        });
                        
                        setUser({ uid: newUser.uid, email: newUser.email, username: newUser.username, role: newUser.role });
                        setProfile(newUser as UserProfile);
                    } else {
                        const data = userSnap.data() as UserProfile;
                        setUser({ uid: data.uid, email: data.email, username: data.username, role: data.role || 'player' });
                        setProfile(data);
                    }
                } else {
                    setUser(null);
                    setProfile(null);
                }
            } catch (error) {
                console.error("Error in auth state change:", error);
                // If there's an error (e.g., permission denied), we should still stop loading
                // and potentially clear the user state to prevent infinite loading
                setUser(null);
                setProfile(null);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            const unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    setProfile(snapshot.data() as UserProfile);
                    // Update user role if it changes in profile
                    if (snapshot.data().role !== user.role) {
                        setUser(prev => prev ? { ...prev, role: snapshot.data().role } : null);
                    }
                }
            });

            // Presence Management
            const updatePresence = async (status: 'online' | 'idle' | 'offline' | 'dnd') => {
                // Don't override DND if they set it manually
                if (profile?.status === 'dnd' && status !== 'offline') return;
                
                try {
                    await updateDoc(userRef, {
                        status,
                        lastActive: serverTimestamp()
                    });
                } catch (e) {
                    console.error("Failed to update presence", e);
                }
            };

            updatePresence('online');

            const handleVisibilityChange = () => {
                if (document.visibilityState === 'visible') {
                    updatePresence('online');
                } else {
                    updatePresence('idle');
                }
            };

            const handleBeforeUnload = () => {
                updatePresence('offline');
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('beforeunload', handleBeforeUnload);

            return () => {
                unsubscribeProfile();
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('beforeunload', handleBeforeUnload);
            };
        }
    }, [user, profile?.status]);

    return (
        <AuthContext.Provider value={{ user, profile, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
