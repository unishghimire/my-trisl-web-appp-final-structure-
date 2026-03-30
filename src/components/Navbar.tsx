import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { Menu, X, Wallet, LogOut, User, Crown, Bell } from 'lucide-react';
import { formatCurrency } from '../utils';
import { NotificationService } from '../services/NotificationService';
import { Notification } from '../types';

const Navbar: React.FC = () => {
    const { user, profile } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            const unsubNotifications = NotificationService.onNotifications(user.uid, setNotifications);
            const unsubCount = NotificationService.onUnreadCount(user.uid, setUnreadCount);
            return () => {
                unsubNotifications();
                unsubCount();
            };
        }
    }, [user]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/');
    };

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    const toggleNotifications = () => setIsNotificationsOpen(!isNotificationsOpen);

    const handleNotificationClick = async (n: Notification) => {
        await NotificationService.markAsRead(n.id);
        if (n.link) navigate(n.link);
        setIsNotificationsOpen(false);
    };

    const handleMarkAllRead = async () => {
        if (user) await NotificationService.markAllAsRead(user.uid);
    };

    const navLinks = [
        { name: 'Home', path: '/' },
        { name: 'Games', path: '/games' },
        { name: 'Tournaments', path: '/tournaments' },
        { name: 'Leaders', path: '/leaderboard', icon: <Crown className="w-4 h-4 mr-1 text-yellow-500" /> },
    ];

    if (user) {
        navLinks.push({ name: 'Dashboard', path: '/dashboard' });
        if (profile?.role === 'organizer' || profile?.role === 'admin') {
            navLinks.push({ name: 'Organizer', path: '/organizer' });
        }
        if (profile?.role === 'admin') {
            navLinks.push({ name: 'Admin', path: '/admin' });
        }
    }

    return (
        <nav className="sticky top-0 z-50 glass-panel">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center cursor-pointer group" onClick={() => navigate('/')}>
                        <img src="https://github.com/unishghimire/nexplay-logo/blob/main/nexplay.jpg?raw=true" alt="Nexplay Logo" className="w-9 h-9 rounded-md mr-2" />
                        <span className="text-xl font-bold tracking-wider text-white">NEX<span className="text-brand-500">PLAY</span></span>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-1">
                            {navLinks.map((link) => (
                                <Link key={link.path} to={link.path} className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition flex items-center">
                                    {link.icon}
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="hidden md:flex items-center space-x-4">
                        {user ? (
                            <div className="flex items-center space-x-4">
                                <div className="relative">
                                    <button onClick={toggleNotifications} className="text-gray-400 hover:text-white transition relative p-2">
                                        <Bell className="w-5 h-5" />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    {isNotificationsOpen && (
                                        <div className="absolute right-0 mt-2 w-80 bg-card border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                                            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                                                <h4 className="text-sm font-bold text-white">Notifications</h4>
                                                <button onClick={handleMarkAllRead} className="text-[10px] text-brand-400 hover:underline">Mark all as read</button>
                                            </div>
                                            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                                {notifications.length > 0 ? (
                                                    notifications.map(n => (
                                                        <div 
                                                            key={n.id} 
                                                            onClick={() => handleNotificationClick(n)}
                                                            className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-surface transition ${!n.read ? 'bg-brand-900/10' : ''}`}
                                                        >
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className={`text-xs font-bold ${n.type === 'alert' ? 'text-red-400' : n.type === 'success' ? 'text-green-400' : 'text-brand-400'}`}>{n.title}</span>
                                                                {!n.read && <span className="w-2 h-2 bg-brand-500 rounded-full"></span>}
                                                            </div>
                                                            <p className="text-xs text-gray-400 line-clamp-2">{n.message}</p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-8 text-center text-gray-500 text-sm">No notifications</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => navigate('/wallet')} className="bg-gray-900 border border-green-500/50 text-green-400 px-4 py-1.5 rounded-full text-sm font-bold flex items-center hover:bg-gray-800 transition">
                                    <Wallet className="w-4 h-4 mr-2" />
                                    {formatCurrency(profile?.balance || 0)}
                                </button>
                                <button onClick={() => navigate('/profile')} className="flex items-center text-sm font-medium text-gray-300 hover:text-white transition">
                                    <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center mr-2 font-bold">
                                        {profile?.username?.[0].toUpperCase()}
                                    </div>
                                </button>
                                <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition" title="Logout">
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => navigate('/profile')} className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg font-bold transition shadow-lg shadow-brand-600/20">LOGIN</button>
                        )}
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button onClick={toggleMobileMenu} className="text-gray-400 hover:text-white p-2 rounded-md focus:outline-none">
                            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>
            {isMobileMenuOpen && (
                <div className="md:hidden bg-dark border-b border-gray-800">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {navLinks.map((link) => (
                            <Link key={link.path} to={link.path} onClick={toggleMobileMenu} className="block px-3 py-3 border-b border-gray-800 text-gray-300 hover:text-white text-base font-medium">
                                {link.name}
                            </Link>
                        ))}
                        {user ? (
                            <>
                                <div className="px-3 py-3 border-b border-gray-800">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-white">Notifications</h4>
                                        <button onClick={handleMarkAllRead} className="text-[10px] text-brand-400 hover:underline">Mark all as read</button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                                        {notifications.length > 0 ? (
                                            notifications.map(n => (
                                                <div 
                                                    key={n.id} 
                                                    onClick={() => handleNotificationClick(n)}
                                                    className={`p-3 rounded-lg border border-gray-800 cursor-pointer hover:bg-surface transition ${!n.read ? 'bg-brand-900/10' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`text-xs font-bold ${n.type === 'alert' ? 'text-red-400' : n.type === 'success' ? 'text-green-400' : 'text-brand-400'}`}>{n.title}</span>
                                                        {!n.read && <span className="w-2 h-2 bg-brand-500 rounded-full"></span>}
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 line-clamp-2">{n.message}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center text-gray-500 text-xs py-4">No notifications</div>
                                        )}
                                    </div>
                                </div>
                                <Link to="/wallet" onClick={toggleMobileMenu} className="block px-3 py-3 border-b border-gray-800 text-green-400 font-bold">
                                    My Wallet ({formatCurrency(profile?.balance || 0)})
                                </Link>
                                <Link to="/profile" onClick={toggleMobileMenu} className="block px-3 py-3 border-b border-gray-800 text-gray-300">
                                    My Profile
                                </Link>
                                <button onClick={() => { handleLogout(); toggleMobileMenu(); }} className="block w-full text-left px-3 py-3 text-red-400 font-bold">
                                    Logout
                                </button>
                            </>
                        ) : (
                            <Link to="/profile" onClick={toggleMobileMenu} className="block px-3 py-3 text-brand-400 font-bold mt-2">
                                LOGIN / SIGN UP
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
