import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProfileCompletionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && user && profile) {
            const isProfileIncomplete = !profile.inGameId || !profile.inGameName;
            const isNotOnCompleteProfilePage = location.pathname !== '/complete-profile';
            
            if (isProfileIncomplete && isNotOnCompleteProfilePage) {
                navigate('/complete-profile', { replace: true });
            }
        }
    }, [user, profile, loading, location.pathname, navigate]);

    if (loading || (user && !profile)) {
        return (
            <div className="min-h-screen bg-dark flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500"></div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProfileCompletionGuard;
