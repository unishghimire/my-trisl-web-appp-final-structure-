import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SiteSettings } from '../types';

interface SiteSettingsContextType {
    settings: SiteSettings | null;
    loading: boolean;
}

const SiteSettingsContext = createContext<SiteSettingsContextType>({
    settings: null,
    loading: true,
});

export const useSiteSettings = () => useContext(SiteSettingsContext);

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'settings', 'site'), (doc) => {
            if (doc.exists()) {
                setSettings(doc.data() as SiteSettings);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching site settings:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <SiteSettingsContext.Provider value={{ settings, loading }}>
            {children}
        </SiteSettingsContext.Provider>
    );
};
