import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

const SUPER_ADMIN_UID = "BLv10u0Ss9SlImH20HjT2oWQO1v2";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                const userRef = doc(db, 'users', u.uid);
                const unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.data() as UserProfile;
                        setProfile(data);
                        
                        // Sync to users_public for leaderboard (only non-PII fields)
                        const publicRef = doc(db, 'users_public', u.uid);
                        await setDoc(publicRef, {
                            uid: u.uid,
                            username: data.username,
                            totalEarnings: data.totalEarnings || 0,
                            inGameId: data.inGameId || '',
                            role: data.role,
                            updatedAt: serverTimestamp()
                        }, { merge: true });
                    } else {
                        const newProfile: UserProfile = {
                            uid: u.uid,
                            email: u.email || '',
                            username: u.displayName || 'Gamer',
                            role: u.uid === SUPER_ADMIN_UID ? 'admin' : 'player',
                            balance: 0,
                            totalEarnings: 0,
                            inGameId: '',
                            teamName: '',
                            phone: '',
                            isBanned: false,
                            createdAt: serverTimestamp(),
                        };
                        await setDoc(userRef, newProfile);
                        
                        // Create public profile
                        const publicRef = doc(db, 'users_public', u.uid);
                        await setDoc(publicRef, {
                            uid: u.uid,
                            username: newProfile.username,
                            totalEarnings: 0,
                            inGameId: '',
                            role: newProfile.role,
                            updatedAt: serverTimestamp()
                        });
                        
                        setProfile(newProfile);
                    }
                    setLoading(false);
                });
                return () => unsubscribeProfile();
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
