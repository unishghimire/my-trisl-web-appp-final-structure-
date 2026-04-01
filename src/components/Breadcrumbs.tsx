import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const Breadcrumbs: React.FC = () => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter((x) => x);

    if (pathnames.length === 0) return null;

    const breadcrumbNameMap: { [key: string]: string } = {
        'tournaments': 'Tournaments',
        'games': 'Games',
        'details': 'Tournament Details',
        'dashboard': 'Dashboard',
        'wallet': 'Wallet',
        'profile': 'Profile',
        'user': 'User',
        'teams': 'Teams',
        'team': 'Team Details',
        'leaderboard': 'Leaderboard',
        'admin': 'Admin Panel',
        'organizer': 'Organizer Panel',
        'login': 'Login',
        'register': 'Register',
        'about': 'About',
        'contact': 'Contact',
        'privacy': 'Privacy',
    };

    return (
        <nav className="container mx-auto px-4 py-2 text-xs flex items-center gap-2 text-gray-500 font-bold uppercase tracking-widest">
            <Link to="/" className="hover:text-brand-400 transition">Home</Link>
            {pathnames.map((value, index) => {
                const last = index === pathnames.length - 1;
                const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                const label = breadcrumbNameMap[value] || value.replace(/-/g, ' ');

                return last ? (
                    <span key={to} className="text-white flex items-center gap-2">
                        <ChevronRight className="w-3 h-3" /> {label}
                    </span>
                ) : (
                    <span key={to} className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3" />
                        <Link to={to} className="hover:text-brand-400 transition">{label}</Link>
                    </span>
                );
            })}
        </nav>
    );
};

export default Breadcrumbs;
